/**
 * Achievements Manager Module (DI-Pure)
 *
 * Manages achievement milestones and rewards.
 * Global storage - achievements stay local, NOT exported with .mcyc.
 * OR-based unlocking: cycles OR tasks can unlock milestones.
 *
 * @module features/achievementsManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, Z_INDEX, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// MILESTONES configuration - dynamically loaded to avoid ES module cache issues
let MILESTONES = null;

// ============================================================================
// CONSTANTS
// ============================================================================



// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

const di = createDIModule('AchievementsManager', {
    AppState: required(),
    appInit: required(),
    showNotification: required(),
    unlockDarkOceanTheme: optional(null),
    unlockGoldenGlowTheme: optional(null),
    unlockMiniGame: optional(null),
    logHistoryEvent: optional(null),
    // Badge UI dependencies
    safeAddEventListener: optional(null)
});

export const setAchievementsManagerDependencies = di.setDependencies;

// ============================================================================
// ACHIEVEMENTS MANAGER CLASS
// ============================================================================

/**
 * Manages achievement milestones and rewards
 */
export class AchievementsManager {
    constructor(overrides = {}) {
        this.deps = di.resolve(overrides);
        this.modalOverlay = null;
        this.milestones = MILESTONES;
        console.log('AchievementsManager initialized');
    }

    // ========================================================================
    // CORE METHODS
    // ========================================================================

    /**
     * Check and unlock achievements based on current progress
     * @param {number} cyclesCompleted - Total cycles completed (app-wide)
     * @param {number} tasksCleared - Total tasks cleared (from userProgress)
     * @returns {Array} Newly unlocked achievements
     */
    checkAchievements(cyclesCompleted, tasksCleared = 0) {
        const state = this.deps.AppState.get();
        const newlyUnlocked = [];

        // Ensure achievements structure exists
        if (!state.achievements) {
            this.deps.AppState.update(s => {
                s.achievements = { unlocked: [], seen: {} };
            }, true);
        }

        const unlocked = state.achievements?.unlocked || [];
        const unlockedIds = new Set(unlocked.map(a => a.milestoneId));

        for (const milestone of this.milestones) {
            // Skip already unlocked
            if (unlockedIds.has(milestone.id)) continue;

            // OR-based: either cycles OR tasks can unlock
            const cyclesMet = cyclesCompleted >= milestone.cycleThreshold;
            const tasksMet = tasksCleared >= milestone.taskThreshold;

            if (cyclesMet || tasksMet) {
                const unlockedVia = cyclesMet ? 'cycles' : 'tasks';
                const valueAtUnlock = cyclesMet ? cyclesCompleted : tasksCleared;

                const achievement = {
                    milestoneId: milestone.id,
                    unlockedAt: Date.now(),
                    unlockedVia,
                    valueAtUnlock
                };

                newlyUnlocked.push({ milestone, achievement });

                // Record the unlock
                this.deps.AppState.update(s => {
                    if (!s.achievements) {
                        s.achievements = { unlocked: [], seen: {} };
                    }
                    s.achievements.unlocked.push(achievement);
                }, true);

                // NOTE: Rewards are triggered by handleMilestoneUnlocks() in cycleCompletion.js
                // We don't call _triggerReward() here to avoid duplicate unlock notifications

                // Log history event
                if (this.deps.logHistoryEvent) {
                    this.deps.logHistoryEvent('achievement_unlocked', {
                        achievementId: milestone.id,
                        achievementName: milestone.name,
                        unlockedVia
                    });
                }

                // Show notification
                this.deps.showNotification(
                    `Achievement Unlocked: ${milestone.name}!`,
                    'success',
                    5000
                );
            }
        }

        return newlyUnlocked;
    }

    /**
     * Trigger reward for a milestone
     * @private
     */
    _triggerReward(milestone, unlockedVia) {
        if (!milestone.reward) return;

        console.log(`Triggering reward: ${milestone.reward} (${milestone.rewardType})`);

        switch (milestone.rewardType) {
            case 'theme':
                if (milestone.reward === 'dark-ocean' && this.deps.unlockDarkOceanTheme) {
                    this.deps.unlockDarkOceanTheme();
                } else if (milestone.reward === 'golden-glow' && this.deps.unlockGoldenGlowTheme) {
                    this.deps.unlockGoldenGlowTheme();
                }
                break;
            case 'game':
                if (this.deps.unlockMiniGame) {
                    this.deps.unlockMiniGame(milestone.reward);
                }
                break;
        }
    }

    /**
     * Get all achievements (unlocked and locked)
     * @returns {Object} { unlocked: Array, upcoming: Array }
     */
    getAchievements() {
        const state = this.deps.AppState.get();
        const unlocked = state.achievements?.unlocked || [];
        const unlockedIds = new Set(unlocked.map(a => a.milestoneId));

        // Get progress for upcoming
        const cyclesCompleted = state.userProgress?.cyclesCompleted || 0;
        const tasksCleared = state.userProgress?.totalTasksCompleted || 0;

        const unlockedWithDetails = unlocked.map(a => ({
            ...a,
            milestone: this.milestones.find(m => m.id === a.milestoneId)
        })).sort((a, b) => b.unlockedAt - a.unlockedAt);

        const upcoming = this.milestones
            .filter(m => !unlockedIds.has(m.id))
            .map(m => ({
                milestone: m,
                cycleProgress: Math.min(100, (cyclesCompleted / m.cycleThreshold) * 100),
                taskProgress: Math.min(100, (tasksCleared / m.taskThreshold) * 100),
                cyclesNeeded: Math.max(0, m.cycleThreshold - cyclesCompleted),
                tasksNeeded: Math.max(0, m.taskThreshold - tasksCleared)
            }));

        return {
            unlocked: unlockedWithDetails,
            upcoming,
            cyclesCompleted,
            tasksCleared
        };
    }

    /**
     * Check if a specific achievement is unlocked
     * @param {string} milestoneId - Milestone ID to check
     * @returns {boolean}
     */
    isUnlocked(milestoneId) {
        const state = this.deps.AppState.get();
        const unlocked = state.achievements?.unlocked || [];
        return unlocked.some(a => a.milestoneId === milestoneId);
    }

    // ========================================================================
    // MODAL METHODS
    // ========================================================================

    /**
     * Open the achievements modal
     */
    openModal() {
        if (this.modalOverlay) {
            this.closeModal();
        }

        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'achievements-modal-overlay';
        this.modalOverlay.setAttribute('role', 'dialog');
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.setAttribute('aria-label', getLabel('history.achievements'));
        this.modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${Z_INDEX.OVERLAY_CRITICAL};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        this.modalOverlay.innerHTML = `
            <div class="achievements-modal" style="
                background: var(--bg-primary, #fff);
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                transform: translateY(20px);
                transition: transform 0.2s ease;
            ">
                <header style="
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                    gap: 12px;
                ">
                    <button class="achievements-back-btn" aria-label="${getLabel('button.close')}" style="
                        background: none;
                        border: none;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 4px 8px;
                        color: var(--text-primary, #333);
                    ">&larr;</button>
                    <h2 style="
                        flex: 1;
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--text-primary, #333);
                    ">Achievements</h2>
                </header>
                <div class="achievements-modal-content" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                "></div>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);

        // Setup event handlers
        this._setupModalHandlers();

        // Render content
        this._renderModalContent();

        // Animate in
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_MODAL).style.transform = 'translateY(0)';
        });
    }

    /**
     * Close the achievements modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        // Clean up badge detail if open (prevents coin spin listener leak)
        this.hideBadgeDetail();

        // Fix #63: Remove escape handler when modal closes by any means
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        // Clean up button and overlay handlers
        if (this._overlayClickHandler) {
            this.modalOverlay.removeEventListener('click', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }
        if (this._backBtnHandler) {
            const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_BACK_BTN);
            backBtn?.removeEventListener('click', this._backBtnHandler);
            this._backBtnHandler = null;
        }

        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_MODAL).style.transform = 'translateY(20px)';

        setTimeout(() => {
            this.modalOverlay?.remove();
            this.modalOverlay = null;
        }, 200);
    }

    /**
     * Setup modal event handlers
     * @private
     */
    _setupModalHandlers() {
        if (!this.modalOverlay) return;

        // Back button (store handler for cleanup)
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_BACK_BTN);
        this._backBtnHandler = () => this.closeModal();
        backBtn?.addEventListener('click', this._backBtnHandler);

        // Click outside to close (store handler for cleanup)
        this._overlayClickHandler = (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        };
        this.modalOverlay.addEventListener('click', this._overlayClickHandler);

        // Fix #63: Store escape handler reference for proper cleanup
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modalOverlay) {
                this.closeModal();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    /**
     * Render modal content
     * @private
     */
    _renderModalContent() {
        const content = this.modalOverlay?.querySelector(DOM_SELECTORS.ACHIEVEMENTS_MODAL_CONTENT);
        if (!content) return;

        const { unlocked, upcoming, cyclesCompleted, tasksCleared } = this.getAchievements();

        let html = '';

        // Progress summary
        html += `
            <div style="
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
                text-align: center;
            ">
                <div style="display: flex; justify-content: space-around; gap: 16px;">
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: #4361ee;">${cyclesCompleted}</div>
                        <div style="font-size: 12px; color: var(--text-secondary, #666);">Cycles</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: #10b981;">${tasksCleared}</div>
                        <div style="font-size: 12px; color: var(--text-secondary, #666);">Cleared Tasks</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--text-primary, #333);">${unlocked.length}</div>
                        <div style="font-size: 12px; color: var(--text-primary, #333);">Unlocked</div>
                    </div>
                </div>
            </div>
        `;

        // Unlocked achievements
        if (unlocked.length > 0) {
            html += `
                <h3 style="
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-secondary, #666);
                    text-transform: uppercase;
                    margin: 0 0 12px;
                ">Unlocked</h3>
            `;
            html += unlocked.map(a => this._renderUnlockedAchievement(a)).join('');
        }

        // Upcoming achievements
        if (upcoming.length > 0) {
            html += `
                <h3 style="
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-secondary, #666);
                    text-transform: uppercase;
                    margin: 20px 0 12px;
                ">Upcoming</h3>
            `;
            html += upcoming.map(u => this._renderUpcomingAchievement(u)).join('');
        }

        if (unlocked.length === 0 && upcoming.length === 0) {
            html = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #666);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
                    <p style="margin: 0;">No achievements available</p>
                </div>
            `;
        }

        content.innerHTML = html;
    }

    /**
     * Render an unlocked achievement
     * @private
     */
    _renderUnlockedAchievement(achievement) {
        const { milestone } = achievement;
        if (!milestone) return '';

        const date = new Date(achievement.unlockedAt);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <div style="
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                margin-bottom: 8px;
            ">
                <span style="font-size: 28px;">${milestone.emoji || '🏆'}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-weight: 600;
                        color: var(--text-primary, #333);
                    ">${milestone.name}</div>
                    <div style="
                        font-size: 13px;
                        color: var(--text-secondary, #666);
                        margin-top: 2px;
                    ">${milestone.description}</div>
                    <div style="
                        font-size: 12px;
                        color: var(--text-secondary, #888);
                        margin-top: 4px;
                    ">
                        Unlocked ${dateStr} via ${achievement.unlockedVia}
                    </div>
                    ${milestone.rewardLabel ? `
                        <div style="
                            font-size: 12px;
                            color: var(--success-color, #28a745);
                            margin-top: 4px;
                            font-weight: 500;
                        ">Reward: ${milestone.rewardLabel}</div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render an upcoming achievement
     * @private
     */
    _renderUpcomingAchievement(upcoming) {
        const { milestone, cycleProgress, taskProgress, cyclesNeeded, tasksNeeded } = upcoming;

        // Determine which is higher to layer correctly (higher in back, lower in front)
        const cyclesHigher = cycleProgress >= taskProgress;

        return `
            <div style="
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                margin-bottom: 8px;
                opacity: 0.8;
            ">
                <span style="font-size: 28px; filter: grayscale(1);">${milestone.emoji || '🏆'}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-weight: 600;
                        color: var(--text-primary, #333);
                    ">${milestone.name}</div>
                    <div style="
                        font-size: 13px;
                        color: var(--text-secondary, #666);
                        margin-top: 2px;
                    ">${milestone.description}</div>
                    <!-- Combined progress bar -->
                    <div style="
                        position: relative;
                        background: var(--border-color, #e0e0e0);
                        border-radius: 4px;
                        height: 8px;
                        margin-top: 8px;
                        overflow: hidden;
                    ">
                        <!-- Background bar (higher progress) -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            background: ${cyclesHigher ? '#4361ee' : '#10b981'};
                            height: 100%;
                            width: ${Math.max(cycleProgress, taskProgress)}%;
                            border-radius: 4px;
                            transition: width 0.3s ease;
                        "></div>
                        <!-- Foreground bar (lower progress) -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            background: ${cyclesHigher ? '#10b981' : '#4361ee'};
                            height: 100%;
                            width: ${Math.min(cycleProgress, taskProgress)}%;
                            border-radius: 4px;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <!-- Legend and Reward -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-top: 6px;
                        font-size: 11px;
                    ">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="color: #4361ee; font-weight: 500;">
                                <span style="font-size: 14px;">●</span> ${cyclesNeeded} cycles
                            </span>
                            <span style="color: #10b981; font-weight: 500;">
                                <span style="font-size: 14px;">●</span> ${tasksNeeded} cleared tasks
                            </span>
                        </div>
                        ${milestone.rewardLabel ? `
                            <span style="
                                font-size: 11px;
                                color: var(--text-secondary, #888);
                                font-weight: 500;
                            ">Reward: ${milestone.rewardLabel}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // BADGE UI METHODS (extracted from statsPanel.js)
    // ========================================================================

    /**
     * Initialize badge tooltips and click handlers from MILESTONES constant
     * Sets title attributes dynamically so they stay in sync with constants.js
     */
    initBadgeTooltips() {
        const safeAddEventListener = this.deps.safeAddEventListener;

        document.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const tierConfig = MILESTONES.find(t => t.cycleThreshold === milestone);

            if (tierConfig) {
                let tooltip = `${tierConfig.name}: ${tierConfig.cycleThreshold} cycles OR ${tierConfig.taskThreshold} cleared tasks`;
                if (tierConfig.rewardLabel) {
                    tooltip += ` - Unlocks ${tierConfig.rewardLabel}`;
                }
                badge.title = tooltip;

                // Make badge clickable
                badge.style.cursor = 'pointer';

                // Store handler reference for safeAddEventListener
                badge._badgeClickHandler = () => this.showBadgeDetail(milestone);

                if (safeAddEventListener) {
                    safeAddEventListener(badge, 'click', badge._badgeClickHandler);
                } else {
                    badge.addEventListener('click', badge._badgeClickHandler);
                }
            }
        });
        console.log('✅ Badge tooltips and click handlers initialized from constants');
    }

    /**
     * Show badge detail popup
     * @param {number} milestone - The milestone cycle count
     */
    showBadgeDetail(milestone) {
        const tierConfig = MILESTONES ? MILESTONES.find(t => t.cycleThreshold === milestone) : null;
        if (!tierConfig) return;

        // Close any existing popup
        this.hideBadgeDetail();

        // Get achievement data
        const achievements = this.getAchievements();

        // Check if this badge is unlocked
        const unlockedAchievement = achievements.unlocked.find(a => a.milestoneId === tierConfig.id);
        const isUnlocked = !!unlockedAchievement;

        // Calculate progress if not unlocked
        const cycleProgress = Math.min(100, (achievements.cyclesCompleted / tierConfig.cycleThreshold) * 100);
        const taskProgress = Math.min(100, (achievements.tasksCleared / tierConfig.taskThreshold) * 100);
        const cyclesNeeded = Math.max(0, tierConfig.cycleThreshold - achievements.cyclesCompleted);
        const tasksNeeded = Math.max(0, tierConfig.taskThreshold - achievements.tasksCleared);
        const cyclesHigher = cycleProgress >= taskProgress;

        // Determine badge circle color based on unlock status and reward
        let badgeBackground = 'linear-gradient(135deg, #e0e0e0, #c0c0c0)'; // Default gray for locked
        if (isUnlocked) {
            if (tierConfig.reward === 'dark-ocean') {
                badgeBackground = 'linear-gradient(135deg, #1a5276, #2980b9)';
            } else if (tierConfig.reward === 'golden-glow') {
                badgeBackground = 'linear-gradient(135deg, #b8860b, #ffd700)';
            } else if (tierConfig.reward === 'whack-a-order') {
                badgeBackground = 'linear-gradient(135deg, #8b0000, #dc143c)';
            } else {
                badgeBackground = 'linear-gradient(135deg, #28a745, #5cb85c)';
            }
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'badge-detail-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${Z_INDEX.NOTIFICATION};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        // Build popup content
        let progressHtml = '';
        if (!isUnlocked) {
            progressHtml = `
                <div style="width: 100%; max-width: 180px; margin-top: 4px;">
                    <div style="
                        position: relative;
                        background: var(--border-color, #e0e0e0);
                        border-radius: 4px;
                        height: 8px;
                        overflow: hidden;
                    ">
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            background: ${cyclesHigher ? '#4361ee' : '#10b981'};
                            height: 100%;
                            width: ${Math.max(cycleProgress, taskProgress)}%;
                            border-radius: 4px;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            background: ${cyclesHigher ? '#10b981' : '#4361ee'};
                            height: 100%;
                            width: ${Math.min(cycleProgress, taskProgress)}%;
                            border-radius: 4px;
                        "></div>
                    </div>
                    <div style="
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        margin-top: 8px;
                        font-size: 11px;
                    ">
                        <span style="color: #4361ee; font-weight: 500;">
                            <span style="font-size: 14px;">●</span> ${cyclesNeeded} cycles
                        </span>
                        <span style="color: #10b981; font-weight: 500;">
                            <span style="font-size: 14px;">●</span> ${tasksNeeded} cleared tasks
                        </span>
                    </div>
                </div>
            `;
        }

        let statusHtml = '';
        if (isUnlocked) {
            const date = new Date(unlockedAchievement.unlockedAt);
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            statusHtml = `
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary, #888);">
                    Unlocked ${dateStr} via ${unlockedAchievement.unlockedVia}
                </p>
            `;
        }

        // Drag to spin hint (only for unlocked badges)
        const dragHintHtml = isUnlocked ? `
            <p style="margin: 4px 0 0; font-size: 11px; color: var(--text-secondary, #aaa); font-style: italic;">
                drag to spin
            </p>
        ` : '';

        overlay.innerHTML = `
            <div style="
                background: var(--bg-primary, #fff);
                border-radius: 16px;
                padding: 24px;
                min-width: 260px;
                max-width: 300px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.2s ease;
            ">
                <!-- Badge circle with 3D perspective and expanded hit area -->
                <div id="badge-spin-area" style="
                    padding: 20px;
                    margin: -20px;
                    perspective: 300px;
                    ${isUnlocked ? 'cursor: grab;' : ''}
                ">
                    <div id="badge-coin" style="
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        background: ${badgeBackground};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        transform-style: preserve-3d;
                        transition: transform 0.1s ease-out;
                        ${!isUnlocked ? 'filter: grayscale(0.8);' : ''}
                    ">
                        <span style="font-size: 40px; pointer-events: none;">${tierConfig.emoji}</span>
                    </div>
                </div>
                ${dragHintHtml}

                <h3 style="margin: 8px 0 4px; font-size: 20px; color: var(--text-primary, #333);">${tierConfig.name}</h3>
                <p style="margin: 0 0 12px; font-size: 13px; color: var(--text-secondary, #666);">
                    ${tierConfig.cycleThreshold} cycles or ${tierConfig.taskThreshold} cleared tasks
                </p>

                ${statusHtml}
                ${progressHtml}

                ${tierConfig.rewardLabel ? `
                    <p style="margin: 12px 0 0; font-size: 12px; color: var(--primary-color, #4c79ff);">
                        <strong>Reward:</strong> ${tierConfig.rewardLabel}
                    </p>
                ` : ''}
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.querySelector('div').style.transform = 'scale(1)';
        });

        // Add coin spin interaction for unlocked badges
        if (isUnlocked) {
            const spinArea = document.getElementById(DOM_IDS.BADGE_SPIN_AREA);
            const coin = document.getElementById(DOM_IDS.BADGE_COIN);
            if (spinArea && coin) {
                let isDragging = false;
                let startX = 0;
                let currentRotation = 0;
                let velocity = 0;
                let animationFrame = null;
                let lastHapticRotation = 0;

                // Haptic feedback helper
                const triggerHaptic = (duration = 10) => {
                    if (navigator.vibrate) {
                        navigator.vibrate(duration);
                    }
                };

                const onStart = (e) => {
                    isDragging = true;
                    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                    spinArea.style.cursor = 'grabbing';
                    coin.style.transition = 'none';
                    lastHapticRotation = currentRotation;
                    triggerHaptic(5); // Light tap on grab
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                        animationFrame = null;
                    }
                };

                const onMove = (e) => {
                    if (!isDragging) return;
                    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                    const deltaX = clientX - startX;
                    velocity = deltaX - (currentRotation % 360);
                    currentRotation = deltaX * 2; // Multiply for more spin
                    coin.style.transform = `rotateY(${currentRotation}deg)`;

                    // Haptic tick every 180 degrees
                    if (Math.abs(currentRotation - lastHapticRotation) >= 180) {
                        triggerHaptic(5);
                        lastHapticRotation = currentRotation;
                    }
                };

                const onEnd = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    spinArea.style.cursor = 'grab';

                    // Add momentum spin
                    const spinWithMomentum = () => {
                        velocity *= 0.95; // Friction
                        currentRotation += velocity;
                        coin.style.transform = `rotateY(${currentRotation}deg)`;

                        // Haptic tick every 180 degrees during momentum
                        if (Math.abs(currentRotation - lastHapticRotation) >= 180) {
                            triggerHaptic(3);
                            lastHapticRotation = currentRotation;
                        }

                        if (Math.abs(velocity) > 0.5) {
                            animationFrame = requestAnimationFrame(spinWithMomentum);
                        } else {
                            // Ease back to flat
                            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                            const easeDuration = reducedMotion ? '0ms' : '0.3s';
                            coin.style.transition = `transform ${easeDuration} ease-out`;
                            const nearestFlat = Math.round(currentRotation / 360) * 360;
                            coin.style.transform = `rotateY(${nearestFlat}deg)`;
                            currentRotation = nearestFlat;
                            triggerHaptic(8); // Settle haptic
                        }
                    };

                    if (Math.abs(velocity) > 2) {
                        coin.style.transition = 'none';
                        spinWithMomentum();
                    } else {
                        // Ease back to flat
                        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                        const easeDuration = reducedMotion ? '0ms' : '0.3s';
                        coin.style.transition = `transform ${easeDuration} ease-out`;
                        coin.style.transform = 'rotateY(0deg)';
                        currentRotation = 0;
                        triggerHaptic(8); // Settle haptic
                    }
                };

                // Mouse events - attach to spin area for larger hit target
                spinArea.addEventListener('mousedown', onStart);
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onEnd);

                // Touch events
                spinArea.addEventListener('touchstart', onStart, { passive: true });
                document.addEventListener('touchmove', onMove, { passive: true });
                document.addEventListener('touchend', onEnd);

                // Store cleanup function
                this._badgeCoinCleanup = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onEnd);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onEnd);
                    if (animationFrame) cancelAnimationFrame(animationFrame);
                };
            }
        }

        // Close on overlay click (store handler for cleanup)
        this._badgeOverlayClickHandler = (e) => {
            if (e.target === overlay) {
                this.hideBadgeDetail();
            }
        };
        overlay.addEventListener('click', this._badgeOverlayClickHandler);

        // Close on escape
        this._badgeDetailEscHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideBadgeDetail();
            }
        };
        document.addEventListener('keydown', this._badgeDetailEscHandler);
    }

    /**
     * Hide badge detail popup
     */
    hideBadgeDetail() {
        const overlay = document.getElementById(DOM_IDS.BADGE_DETAIL_OVERLAY);
        if (!overlay) return;

        overlay.style.opacity = '0';
        const popup = overlay.querySelector('div');
        if (popup) popup.style.transform = 'scale(0.9)';

        setTimeout(() => overlay.remove(), UI_TIMEOUTS.ANIMATION_SHORT);

        // Cleanup coin spin listeners
        if (this._badgeCoinCleanup) {
            this._badgeCoinCleanup();
            this._badgeCoinCleanup = null;
        }

        // Cleanup overlay click handler
        if (this._badgeOverlayClickHandler && overlay) {
            overlay.removeEventListener('click', this._badgeOverlayClickHandler);
            this._badgeOverlayClickHandler = null;
        }

        if (this._badgeDetailEscHandler) {
            document.removeEventListener('keydown', this._badgeDetailEscHandler);
            this._badgeDetailEscHandler = null;
        }
    }

    /**
     * Update achievement badges based on GLOBAL cycles completed
     * Uses MILESTONES constant from constants.js as single source of truth
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     */
    updateBadges(globalCyclesCompleted) {
        document.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const isUnlocked = globalCyclesCompleted >= milestone;

            badge.classList.toggle("unlocked", isUnlocked);

            // Reset theme badge classes
            badge.classList.remove("ocean-theme", "golden-theme", "game-unlocked");

            // Find the tier config for this milestone from constants
            const tierConfig = MILESTONES ? MILESTONES.find(t => t.cycleThreshold === milestone) : null;

            // Assign custom theme class based on reward type from constant
            if (isUnlocked && tierConfig) {
                if (tierConfig.reward === 'dark-ocean') {
                    badge.classList.add("ocean-theme");
                } else if (tierConfig.reward === 'golden-glow') {
                    badge.classList.add("golden-theme");
                } else if (tierConfig.reward === 'whack-a-order') {
                    badge.classList.add("game-unlocked");
                }
            }
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let instance = null;

/**
 * Initialize the achievements manager
 * Dynamically loads MILESTONES from constants.js with version cache-busting
 * @param {Object} deps - Dependencies
 * @returns {Promise<AchievementsManager>}
 */
export async function initAchievementsManager(deps = {}) {
    // Load MILESTONES from constants.js dynamically on first init
    if (!MILESTONES) {
        const version = APP_VERSION;
        console.log(`📦 AchievementsManager: Loading MILESTONES with version ${version}...`);

        const constantsMod = await import(`../core/constants.js?v=${version}`);
        const MILESTONE_CONFIG = constantsMod.MILESTONES;

        // Transform MILESTONE_CONFIG.TIERS into MILESTONES array
        MILESTONES = MILESTONE_CONFIG.TIERS.map(tier => ({
            id: tier.id,
            name: tier.name,
            emoji: tier.emoji,
            description: `Complete ${tier.cycles} cycles or ${tier.tasks} cleared tasks`,
            cycleThreshold: tier.cycles,
            taskThreshold: tier.tasks,
            reward: tier.reward,
            rewardType: tier.rewardType,
            rewardLabel: tier.rewardLabel || null
        }));

        console.log('✅ AchievementsManager: MILESTONES loaded');
    }

    if (!instance) {
        instance = new AchievementsManager(deps);
        // Initialize badge tooltips now that instance exists
        // This runs when achievementsManager loads (Phase 7), after DOM is ready
        instance.initBadgeTooltips();
    }
    return instance;
}

/**
 * Get the achievements manager instance
 * @returns {AchievementsManager|null}
 */
export function getAchievementsManager() {
    return instance;
}

console.log('AchievementsManager module loaded (DI-pure)');
