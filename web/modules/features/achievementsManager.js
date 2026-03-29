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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION } from '../core/constants.js';
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
        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.style.transition = 'opacity 0.2s ease';

        this.modalOverlay.innerHTML = `
            <div class="achievements-modal">
                <header class="achievements-header">
                    <button class="achievements-back-btn" aria-label="${getLabel('button.close')}">&larr;</button>
                    <h2 class="achievements-title">${getLabel('achievement.title')}</h2>
                </header>
                <div class="achievements-modal-content"></div>
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
            <div class="achievements-summary">
                <div class="achievements-summary-row">
                    <div>
                        <div class="achievements-stat-value achievements-stat-value--cycles">${cyclesCompleted}</div>
                        <div class="achievements-stat-label">${getLabel('achievement.statCycles')}</div>
                    </div>
                    <div>
                        <div class="achievements-stat-value achievements-stat-value--tasks">${tasksCleared}</div>
                        <div class="achievements-stat-label">${getLabel('achievement.statCleared')}</div>
                    </div>
                    <div>
                        <div class="achievements-stat-value achievements-stat-value--count">${unlocked.length}</div>
                        <div class="achievements-stat-label">${getLabel('achievement.statUnlocked')}</div>
                    </div>
                </div>
            </div>
        `;

        // Unlocked achievements
        if (unlocked.length > 0) {
            html += `<div class="achievements-unlocked">`;
            html += `
                <h3 class="achievements-section-heading">${getLabel('achievement.sectionUnlocked')}</h3>
            `;
            html += unlocked.map(a => this._renderUnlockedAchievement(a)).join('');
            html += `</div>`;
        }

        // Upcoming achievements
        if (upcoming.length > 0) {
            html += `<div class="achievements-upcoming">`;
            html += `
                <h3 class="achievements-section-heading achievements-section-heading--upcoming">${getLabel('achievement.sectionUpcoming')}</h3>
            `;
            html += upcoming.map(u => this._renderUpcomingAchievement(u)).join('');
            html += `</div>`;
        }

        if (unlocked.length === 0 && upcoming.length === 0) {
            html = `
                <div class="achievements-empty-state">
                    <div class="achievements-empty-emoji">🏆</div>
                    <p class="achievements-empty-text">${getLabel('achievement.noAchievements')}</p>
                </div>
            `;
        }

        // Achievement progress note
        html += `
            <p class="achievements-progress-note">${getLabel('achievement.progressNote')}</p>
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
            <div class="achievement-card">
                <span class="achievement-card-emoji">${milestone.emoji || '🏆'}</span>
                <div class="achievement-card-content">
                    <div class="achievement-card-name">${milestone.name}</div>
                    <div class="achievement-card-description">${getLabel('achievement.description', { vars: { cycles: milestone.cycleThreshold, tasks: milestone.taskThreshold } })}</div>
                    <div class="achievement-card-date">
                        ${getLabel('achievement.unlockedOn', { vars: { date: dateStr, via: achievement.unlockedVia === 'cycles' ? getLabel('noun.cycle', { count: 2 }) : getLabel('noun.task', { count: 2 }) } })}
                    </div>
                    ${milestone.rewardLabel ? `
                        <div class="achievement-card-reward">${getLabel('achievement.reward', { vars: { label: milestone.rewardLabel } })}</div>
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
            <div class="achievement-card achievement-card--upcoming">
                <span class="achievement-card-emoji">${milestone.emoji || '🏆'}</span>
                <div class="achievement-card-content">
                    <div class="achievement-card-name">${milestone.name}</div>
                    <div class="achievement-card-description">${getLabel('achievement.description', { vars: { cycles: milestone.cycleThreshold, tasks: milestone.taskThreshold } })}</div>
                    <div class="achievement-progress-bar" role="progressbar"
                        aria-valuenow="${Math.round(Math.max(cycleProgress, taskProgress))}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label="${milestone.name} progress">
                        <div class="achievement-progress-fill ${cyclesHigher ? 'achievement-progress-fill--cycles' : 'achievement-progress-fill--tasks'}" style="width: ${Math.max(cycleProgress, taskProgress)}%;"></div>
                        <div class="achievement-progress-fill ${cyclesHigher ? 'achievement-progress-fill--tasks' : 'achievement-progress-fill--cycles'}" style="width: ${Math.min(cycleProgress, taskProgress)}%;"></div>
                    </div>
                    <div class="achievement-legend">
                        <div class="achievement-legend-items">
                            <span class="achievement-legend-cycles">
                                <span class="achievement-legend-bullet">●</span> ${getLabel('achievement.cyclesNeeded', { vars: { count: cyclesNeeded } })}
                            </span>
                            <span class="achievement-legend-tasks">
                                <span class="achievement-legend-bullet">●</span> ${getLabel('achievement.tasksNeeded', { vars: { count: tasksNeeded } })}
                            </span>
                        </div>
                        ${milestone.rewardLabel ? `
                            <span class="achievement-legend-reward">${getLabel('achievement.reward', { vars: { label: milestone.rewardLabel } })}</span>
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

        // One-time hint to tap/click badges for more info
        const state = this.deps.AppState?.get?.();
        if (state && !state.settings?.badgeHintShown) {
            const badgesEl = this.deps.querySelector(DOM_SELECTORS.BADGES_CONTAINER);
            if (badgesEl) {
                const hint = document.createElement('p');
                hint.className = 'badge-tap-hint';
                hint.textContent = getLabel('achievement.badgeTapHint');
                badgesEl.parentElement.insertBefore(hint, badgesEl.nextSibling);
                this.deps.AppState.update(s => {
                    s.settings.badgeHintShown = true;
                });
            }
        }

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
     * @returns {void}
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

        // Determine reward attribute for CSS theming
        const rewardAttr = isUnlocked ? tierConfig.reward : null;

        // Create overlay
        const overlay = document.createElement('dialog');
        overlay.id = 'badge-detail-overlay';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';

        // Build popup content
        let progressHtml = '';
        if (!isUnlocked) {
            progressHtml = `
                <div class="badge-detail-progress">
                    <div class="achievement-progress-bar">
                        <div class="achievement-progress-fill ${cyclesHigher ? 'achievement-progress-fill--cycles' : 'achievement-progress-fill--tasks'}" style="width: ${Math.max(cycleProgress, taskProgress)}%;"></div>
                        <div class="achievement-progress-fill ${cyclesHigher ? 'achievement-progress-fill--tasks' : 'achievement-progress-fill--cycles'}" style="width: ${Math.min(cycleProgress, taskProgress)}%;"></div>
                    </div>
                    <div class="achievement-legend-items badge-detail-progress-legend">
                        <span class="achievement-legend-cycles">
                            <span class="achievement-legend-bullet">●</span> ${getLabel('achievement.cyclesNeeded', { vars: { count: cyclesNeeded } })}
                        </span>
                        <span class="achievement-legend-tasks">
                            <span class="achievement-legend-bullet">●</span> ${getLabel('achievement.tasksNeeded', { vars: { count: tasksNeeded } })}
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
                <p class="badge-detail-status badge-detail-secondary">
                    ${getLabel('achievement.unlockedOn', { vars: { date: dateStr, via: unlockedAchievement.unlockedVia === 'cycles' ? getLabel('noun.cycle', { count: 2 }) : getLabel('noun.task', { count: 2 }) } })}
                </p>
            `;
        }

        // Drag to spin hint (only for unlocked badges)
        const dragHintHtml = isUnlocked ? `
            <p class="badge-detail-drag-hint badge-detail-secondary">
                ${getLabel('achievement.dragToSpin')}
            </p>
        ` : '';

        overlay.innerHTML = `
            <div class="badge-detail-popup" ${rewardAttr ? `data-reward="${rewardAttr}"` : ''}>
                <div id="badge-spin-area" class="badge-spin-area ${isUnlocked ? 'interactive' : ''}">
                    <div id="badge-coin" class="badge-coin ${isUnlocked ? '' : 'badge-coin--locked'}" ${rewardAttr ? `data-reward="${rewardAttr}"` : ''}>
                        <span class="badge-coin-emoji">${tierConfig.emoji}</span>
                    </div>
                </div>
                ${dragHintHtml}

                <h3 class="badge-detail-name">${tierConfig.name}</h3>
                <p class="badge-detail-threshold badge-detail-secondary">
                    ${getLabel('achievement.threshold', { vars: { cycles: tierConfig.cycleThreshold, tasks: tierConfig.taskThreshold } })}
                </p>

                ${statusHtml}
                ${progressHtml}

                ${tierConfig.rewardLabel ? `
                    <p class="badge-detail-reward">
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
            overlay.querySelector('.badge-detail-popup').style.transform = 'scale(1)';
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
     * @returns {void}
     */
    updateBadges(globalCyclesCompleted, globalTasksCleared = 0) {
        this.deps.querySelectorAll(DOM_SELECTORS.BADGE).forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const tierConfig = MILESTONES ? MILESTONES.find(t => t.cycleThreshold === milestone) : null;
            const cyclesMet = globalCyclesCompleted >= milestone;
            const tasksMet = tierConfig ? globalTasksCleared >= tierConfig.taskThreshold : false;
            const isUnlocked = cyclesMet || tasksMet;

            badge.classList.toggle(DOM_CLASSES.UNLOCKED, isUnlocked);

            // Reset theme badge classes
            badge.classList.remove(DOM_CLASSES.OCEAN_THEME, DOM_CLASSES.GOLDEN_THEME, DOM_CLASSES.GAME_UNLOCKED);

            // Assign custom theme class based on reward type from constant
            if (isUnlocked && tierConfig) {
                if (tierConfig.reward === 'dark-ocean') {
                    badge.classList.add(DOM_CLASSES.OCEAN_THEME);
                } else if (tierConfig.reward === 'golden-glow') {
                    badge.classList.add(DOM_CLASSES.GOLDEN_THEME);
                } else if (tierConfig.reward === 'whack-a-order') {
                    badge.classList.add(DOM_CLASSES.GAME_UNLOCKED);
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

