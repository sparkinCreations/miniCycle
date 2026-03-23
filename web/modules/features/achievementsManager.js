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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleHorizontalArrowNav } from '../utils/keyboardNav.js';
import { isClickOnNotification } from '../ui/modalUtils.js';

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
    unlockMiniGame: optional(null),
    logHistoryEvent: optional(null),
    vocabThemeManager: optional(null),
    // Badge UI dependencies
    safeAddEventListener: optional(null),
    // DOM access helpers (testable, avoids direct document.* calls)
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    getBody: optional(() => document.body),
    getActiveElement: optional(() => document.activeElement),
    showAchievementsTourNotification: optional(null),
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

                // Trigger reward (theme unlock, game unlock, etc.)
                // Theme unlock functions are idempotent — safe if also called from cycleCompletion
                this._triggerReward(milestone, unlockedVia);

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
                    getLabel('notify.achievementUnlocked', { vars: { name: milestone.name } }),
                    'success',
                    UI_TIMEOUTS.NOTIFICATION_SLOW
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

        switch (milestone.rewardType) {
            case 'game':
                if (this.deps.unlockMiniGame) {
                    this.deps.unlockMiniGame(milestone.reward);
                }
                break;
            case 'vocab-theme': {
                const wasNew = this.deps.vocabThemeManager?.unlockThemeFromAchievement?.(milestone.reward);
                if (wasNew) {
                    const def = this.deps.vocabThemeManager?.getThemeDefinition?.(milestone.reward);
                    const themeName = def?.name ?? milestone.name;
                    const icon = def?.icons?.celebrate ?? '🎨';
                    this.deps.showNotification(
                        `${icon} ${getLabel('notify.themeUnlocked', { vars: { name: themeName } })}`,
                        'success',
                        6000,
                        {
                            actionButton: {
                                label: getLabel('action.openThemesModal'),
                                onClick: () => this.deps.getElementById(DOM_IDS.OPEN_THEMES_PANEL)?.click()
                            }
                        }
                    );
                }
                break;
            }
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

        this.modalOverlay = document.createElement('dialog');
        this.modalOverlay.id = DOM_IDS.ACHIEVEMENTS_MODAL_DIALOG;
        this.modalOverlay.setAttribute('aria-label', getLabel('history.achievements'));
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.style.cssText = `
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
                    ">${getLabel('achievement.title')}</h2>
                </header>
                <div class="achievements-modal-content" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                "></div>
            </div>
        `;

        this.deps.getBody().appendChild(this.modalOverlay);
        this.modalOverlay._previousFocus = this.deps.getActiveElement();
        this.modalOverlay.showModal();

        // Setup event handlers
        this._setupModalHandlers();

        // Render content
        this._renderModalContent();

        // Animate in and move focus to first focusable element
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_MODAL).style.transform = 'translateY(0)';
            const firstFocusable = this.modalOverlay.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusable) firstFocusable.focus({ focusVisible: false });

            // Trigger guided tour on first open
            this.deps.showAchievementsTourNotification?.();
        });
    }

    /**
     * Close the achievements modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        // Clean up badge detail if open (prevents coin spin listener leak)
        this.hideBadgeDetail();

        // Clean up cancel handler
        if (this._cancelHandler) {
            this.modalOverlay.removeEventListener('cancel', this._cancelHandler);
            this._cancelHandler = null;
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

        const previousFocus = this.modalOverlay._previousFocus;

        // Restore focus before removal to avoid timing issues
        previousFocus?.focus({ focusVisible: false });

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

        const safeAdd = this.deps.safeAddEventListener;

        // Back button (store handler for cleanup)
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.ACHIEVEMENTS_BACK_BTN);
        this._backBtnHandler = () => this.closeModal();
        if (backBtn) {
            safeAdd ? safeAdd(backBtn, 'click', this._backBtnHandler)
                : backBtn.addEventListener('click', this._backBtnHandler);
        }

        // Click outside to close (store handler for cleanup)
        this._overlayClickHandler = (e) => {
            if (e.target === this.modalOverlay && !isClickOnNotification(e)) {
                this.closeModal();
            }
        };
        safeAdd ? safeAdd(this.modalOverlay, 'click', this._overlayClickHandler)
            : this.modalOverlay.addEventListener('click', this._overlayClickHandler);

        // Native dialog handles ESC — use cancel event for cleanup
        this._cancelHandler = (e) => {
            e.preventDefault();
            this.closeModal();
        };
        safeAdd ? safeAdd(this.modalOverlay, 'cancel', this._cancelHandler)
            : this.modalOverlay.addEventListener('cancel', this._cancelHandler);
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
            <div class="achievements-summary" style="
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
                text-align: center;
            ">
                <div style="display: flex; justify-content: space-around; gap: 16px;">
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: #4361ee;">${cyclesCompleted}</div>
                        <div style="font-size: 12px; color: var(--text-secondary, #666);">${getLabel('achievement.statCycles')}</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: #10b981;">${tasksCleared}</div>
                        <div style="font-size: 12px; color: var(--text-secondary, #666);">${getLabel('achievement.statCleared')}</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 600; color: var(--text-primary, #333);">${unlocked.length}</div>
                        <div style="font-size: 12px; color: var(--text-primary, #333);">${getLabel('achievement.statUnlocked')}</div>
                    </div>
                </div>
            </div>
        `;

        // Unlocked achievements
        if (unlocked.length > 0) {
            html += `<div class="achievements-unlocked">`;
            html += `
                <h3 style="
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-secondary, #666);
                    text-transform: uppercase;
                    margin: 0 0 12px;
                ">${getLabel('achievement.sectionUnlocked')}</h3>
            `;
            html += unlocked.map(a => this._renderUnlockedAchievement(a)).join('');
            html += `</div>`;
        }

        // Upcoming achievements
        if (upcoming.length > 0) {
            html += `<div class="achievements-upcoming">`;
            html += `
                <h3 style="
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-secondary, #666);
                    text-transform: uppercase;
                    margin: 20px 0 12px;
                ">${getLabel('achievement.sectionUpcoming')}</h3>
            `;
            html += upcoming.map(u => this._renderUpcomingAchievement(u)).join('');
            html += `</div>`;
        }

        if (unlocked.length === 0 && upcoming.length === 0) {
            html = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #666);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
                    <p style="margin: 0;">${getLabel('achievement.noAchievements')}</p>
                </div>
            `;
        }

        // Achievement progress note
        html += `
            <p style="
                font-size: 12px;
                color: var(--text-secondary, #666);
                text-align: center;
                margin: 16px 0 0;
                font-style: italic;
            ">${getLabel('achievement.progressNote')}</p>
        `;

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
                    ">${getLabel('achievement.description', { vars: { cycles: milestone.cycleThreshold, tasks: milestone.taskThreshold } })}</div>
                    <div style="
                        font-size: 12px;
                        color: var(--text-secondary, #888);
                        margin-top: 4px;
                    ">
                        ${getLabel('achievement.unlockedOn', { vars: { date: dateStr, via: achievement.unlockedVia === 'cycles' ? getLabel('noun.cycle', { count: 2 }) : getLabel('noun.task', { count: 2 }) } })}
                    </div>
                    ${milestone.rewardLabel ? `
                        <div style="
                            font-size: 12px;
                            color: var(--success-color, #28a745);
                            margin-top: 4px;
                            font-weight: 500;
                        ">${getLabel('achievement.reward', { vars: { label: milestone.rewardLabel } })}</div>
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
                    ">${getLabel('achievement.description', { vars: { cycles: milestone.cycleThreshold, tasks: milestone.taskThreshold } })}</div>
                    <!-- Combined progress bar -->
                    <div role="progressbar"
                        aria-valuenow="${Math.round(Math.max(cycleProgress, taskProgress))}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label="${milestone.name} progress"
                        style="
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
                                <span style="font-size: 14px;">●</span> ${getLabel('achievement.cyclesNeeded', { vars: { count: cyclesNeeded } })}
                            </span>
                            <span style="color: #10b981; font-weight: 500;">
                                <span style="font-size: 14px;">●</span> ${getLabel('achievement.tasksNeeded', { vars: { count: tasksNeeded } })}
                            </span>
                        </div>
                        ${milestone.rewardLabel ? `
                            <span style="
                                font-size: 11px;
                                color: var(--text-secondary, #888);
                                font-weight: 500;
                            ">${getLabel('achievement.reward', { vars: { label: milestone.rewardLabel } })}</span>
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

        this.deps.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const tierConfig = MILESTONES.find(t => t.cycleThreshold === milestone);

            if (tierConfig) {
                let tooltip = getLabel('achievement.badgeTooltip', { vars: { name: tierConfig.name, cycles: tierConfig.cycleThreshold, tasks: tierConfig.taskThreshold } });
                if (tierConfig.rewardLabel) {
                    tooltip += ` - ${getLabel('achievement.badgeUnlocks', { vars: { reward: tierConfig.rewardLabel } })}`;
                }
                badge.title = tooltip;

                // Store handler reference for safeAddEventListener
                badge._badgeClickHandler = () => this.showBadgeDetail(milestone);

                // Keyboard activation (Enter/Space)
                badge._badgeKeyHandler = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.showBadgeDetail(milestone);
                    }
                };

                if (safeAddEventListener) {
                    safeAddEventListener(badge, 'click', badge._badgeClickHandler);
                    safeAddEventListener(badge, 'keydown', badge._badgeKeyHandler);
                }
            }
        });

        // Delegated ArrowLeft/Right navigation between badges
        const badgesContainer = this.deps.querySelector(DOM_SELECTORS.BADGES_CONTAINER);
        if (badgesContainer && safeAddEventListener) {
            safeAddEventListener(badgesContainer, 'keydown', (e) => {
                const badge = e.target.closest(DOM_SELECTORS.BADGE);
                if (!badge) return;
                handleHorizontalArrowNav(e, badgesContainer, DOM_SELECTORS.BADGE, {
                    wrap: false, skipHidden: false
                });
            });
        }

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

        // Set aria-expanded on the triggering badge
        const triggerBadge = this.deps.querySelector(`.badge[data-milestone="${milestone}"]`);
        if (triggerBadge) triggerBadge.setAttribute('aria-expanded', 'true');

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

        // Determine badge coin + modal colors based on unlock status and reward
        let badgeBackground = 'linear-gradient(135deg, #e0e0e0, #c0c0c0)'; // locked — gray
        let modalBg         = 'var(--bg-primary, #fff)';
        let textPrimary     = 'var(--text-primary, #333)';
        let textSecondary   = 'var(--text-secondary, #666)';
        let textReward      = 'var(--primary-color, #4c79ff)';
        if (isUnlocked) {
            if (tierConfig.reward === 'habit-tracker') {
                badgeBackground = 'linear-gradient(135deg, #c87132, #e8924a)'; // cognac amber
                modalBg         = '#c87132';
                textPrimary     = '#ffffff';
                textSecondary   = 'rgba(255,255,255,0.8)';
                textReward      = '#ffe0b8';
            } else if (tierConfig.reward === 'fitness') {
                badgeBackground = 'linear-gradient(135deg, #22a05e, #3dba74)'; // athletic green
                modalBg         = '#22a05e';
                textPrimary     = '#ffffff';
                textSecondary   = 'rgba(255,255,255,0.8)';
                textReward      = '#b8f0d4';
            } else if (tierConfig.reward === 'scholar') {
                badgeBackground = 'linear-gradient(135deg, #4440c0, #6560d8)'; // indigo
                modalBg         = '#4440c0';
                textPrimary     = '#ffffff';
                textSecondary   = 'rgba(255,255,255,0.8)';
                textReward      = '#c8c4ff';
            } else if (tierConfig.reward === 'cleaning') {
                badgeBackground = 'linear-gradient(135deg, #0a8db5, #20a8d8)'; // fresh teal
                modalBg         = '#0a8db5';
                textPrimary     = '#ffffff';
                textSecondary   = 'rgba(255,255,255,0.8)';
                textReward      = '#b8eeff';
            } else if (tierConfig.reward === 'whack-a-order') {
                badgeBackground = 'linear-gradient(135deg, #8b0000, #dc143c)'; // game red
                modalBg         = '#8b0000';
                textPrimary     = '#ffffff';
                textSecondary   = 'rgba(255,255,255,0.8)';
                textReward      = '#ffb8c8';
            } else {
                badgeBackground = 'linear-gradient(135deg, #22a05e, #3dba74)';
            }
        }

        // Create overlay
        const overlay = document.createElement('dialog');
        overlay.id = 'badge-detail-overlay';
        overlay.style.cssText = `
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
                            <span style="font-size: 14px;">●</span> ${getLabel('achievement.cyclesNeeded', { vars: { count: cyclesNeeded } })}
                        </span>
                        <span style="color: #10b981; font-weight: 500;">
                            <span style="font-size: 14px;">●</span> ${getLabel('achievement.tasksNeeded', { vars: { count: tasksNeeded } })}
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
                <p style="margin: 0; font-size: 12px; color: ${textSecondary};">
                    ${getLabel('achievement.unlockedOn', { vars: { date: dateStr, via: unlockedAchievement.unlockedVia === 'cycles' ? getLabel('noun.cycle', { count: 2 }) : getLabel('noun.task', { count: 2 }) } })}
                </p>
            `;
        }

        // Drag to spin hint (only for unlocked badges)
        const dragHintHtml = isUnlocked ? `
            <p style="margin: 4px 0 0; font-size: 11px; color: ${textSecondary}; font-style: italic;">
                ${getLabel('achievement.dragToSpin')}
            </p>
        ` : '';

        overlay.innerHTML = `
            <div style="
                background: ${modalBg};
                border-radius: 16px;
                padding: 24px;
                min-width: 260px;
                max-width: 300px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                user-select: text;
                -webkit-user-select: text;
                transform: scale(0.9);
                transition: transform 0.2s ease;
            ">
                <!-- Badge circle with 3D perspective and expanded hit area -->
                <div id="badge-spin-area" style="
                    padding: 20px;
                    margin: -20px;
                    perspective: 300px;
                    user-select: none;
                    -webkit-user-select: none;
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
                        <span style="font-size: 40px;">${tierConfig.emoji}</span>
                    </div>
                </div>
                ${dragHintHtml}

                <h3 style="margin: 8px 0 4px; font-size: 20px; color: ${textPrimary};">${tierConfig.name}</h3>
                <p style="margin: 0 0 12px; font-size: 13px; color: ${textSecondary};">
                    ${getLabel('achievement.threshold', { vars: { cycles: tierConfig.cycleThreshold, tasks: tierConfig.taskThreshold } })}
                </p>

                ${statusHtml}
                ${progressHtml}

                ${tierConfig.rewardLabel ? `
                    <p style="margin: 12px 0 0; font-size: 12px; color: ${textReward};">
                        <strong>${getLabel('achievement.rewardLabel')}</strong> ${tierConfig.rewardLabel}
                    </p>
                ` : ''}
            </div>
        `;

        this.deps.getBody().appendChild(overlay);
        overlay.showModal();

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.querySelector('div').style.transform = 'scale(1)';
        });

        // Add coin spin interaction for unlocked badges
        if (isUnlocked) {
            const spinArea = this.deps.getElementById(DOM_IDS.BADGE_SPIN_AREA);
            const coin = this.deps.getElementById(DOM_IDS.BADGE_COIN);
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

                // Keyboard support (accessibility A7)
                spinArea.setAttribute('tabindex', '0');
                spinArea.setAttribute('role', 'img');
                spinArea.setAttribute('aria-label', getLabel('accessibility.badgeCoinSpin'));

                const onKeydown = (e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const direction = e.key === 'ArrowRight' ? 1 : -1;
                        currentRotation += direction * 90;
                        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                        coin.style.transition = reducedMotion ? 'none' : 'transform 0.3s ease-out';
                        coin.style.transform = `rotateY(${currentRotation}deg)`;
                        triggerHaptic(5);
                    }
                };
                spinArea.addEventListener('keydown', onKeydown);

                // Store cleanup function
                this._badgeCoinCleanup = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onEnd);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onEnd);
                    spinArea.removeEventListener('keydown', onKeydown);
                    if (animationFrame) cancelAnimationFrame(animationFrame);
                };
            }
        }

        // Close on backdrop click — require both mousedown and click on overlay
        // (prevents close when dragging badge spin beyond modal content)
        this._badgeOverlayMousedownHandler = (e) => {
            overlay._backdropMouseDown = e.target === overlay;
        };
        overlay.addEventListener('mousedown', this._badgeOverlayMousedownHandler);
        this._badgeOverlayClickHandler = (e) => {
            if (e.target === overlay && overlay._backdropMouseDown) {
                this.hideBadgeDetail();
            }
            overlay._backdropMouseDown = false;
        };
        overlay.addEventListener('click', this._badgeOverlayClickHandler);

        // Native dialog handles ESC — use cancel event for cleanup
        this._badgeDetailCancelHandler = (e) => {
            e.preventDefault();
            this.hideBadgeDetail();
        };
        overlay.addEventListener('cancel', this._badgeDetailCancelHandler);
    }

    /**
     * Hide badge detail popup
     */
    hideBadgeDetail() {
        const overlay = this.deps.getElementById(DOM_IDS.BADGE_DETAIL_OVERLAY);
        if (!overlay) return;

        // Reset aria-expanded on all badges
        this.deps.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            badge.setAttribute('aria-expanded', 'false');
        });

        overlay.style.opacity = '0';
        const popup = overlay.querySelector('div');
        if (popup) popup.style.transform = 'scale(0.9)';

        setTimeout(() => overlay.remove(), UI_TIMEOUTS.ANIMATION_SHORT);

        // Cleanup coin spin listeners
        if (this._badgeCoinCleanup) {
            this._badgeCoinCleanup();
            this._badgeCoinCleanup = null;
        }

        // Cleanup overlay listeners
        if (this._badgeOverlayMousedownHandler && overlay) {
            overlay.removeEventListener('mousedown', this._badgeOverlayMousedownHandler);
            this._badgeOverlayMousedownHandler = null;
        }
        if (this._badgeOverlayClickHandler && overlay) {
            overlay.removeEventListener('click', this._badgeOverlayClickHandler);
            this._badgeOverlayClickHandler = null;
        }

        if (this._badgeDetailCancelHandler && overlay) {
            overlay.removeEventListener('cancel', this._badgeDetailCancelHandler);
            this._badgeDetailCancelHandler = null;
        }
    }

    /**
     * Update achievement badges based on GLOBAL cycles completed OR tasks cleared
     * Uses MILESTONES constant from constants.js as single source of truth
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {number} globalTasksCleared - Total tasks cleared across all routines
     */
    updateBadges(globalCyclesCompleted, globalTasksCleared = 0) {
        this.deps.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const tierConfig = MILESTONES ? MILESTONES.find(t => t.cycleThreshold === milestone) : null;
            const cyclesMet = globalCyclesCompleted >= milestone;
            const tasksMet = tierConfig ? globalTasksCleared >= tierConfig.taskThreshold : false;
            const isUnlocked = cyclesMet || tasksMet;

            badge.classList.toggle("unlocked", isUnlocked);

            // Reset theme badge classes
            badge.classList.remove("ocean-theme", "golden-theme", "game-unlocked");

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

