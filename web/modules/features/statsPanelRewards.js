/**
 * statsPanelRewards.js — vocabulary-theme & milestone unlock messaging for the
 * stats panel (Milestone Rewards section, theme unlock toasts, Themes modal).
 *
 * Facade-style sub-module of statsPanel.js (D-03 split, Aug 2026): loaded via
 * dynamic import with ?v= cache-busting from StatsPanelManager.init(). Do NOT
 * add it to moduleManifests.js — same rule as the settingsManager/taskDOM
 * sub-modules (see HIDDEN_CODEBASE_INSIGHTS).
 *
 * Shared state stays OWNED by the manager (`this.m`); the module-scope DI
 * proxy is reached via `this.m.rawDeps`, and the dynamically-loaded MILESTONES
 * config via `this.m.MILESTONES`. Methods were moved VERBATIM from
 * statsPanel.js with only those ownership rewrites.
 */
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { DOM_CLASSES, DOM_SELECTORS } from '../core/constants.js';

export class StatsPanelRewards {
    constructor(manager) {
        this.m = manager;
    }

    updateThemeUnlockStatus(globalCyclesCompleted) {

        let unlockedThemes = [];
        let unlockedFeatures = [];

        // ✅ Use state-based data access - DI-pure
        const AppState = this.m.dependencies.AppState;
        if (AppState?.isReady?.()) {
            const currentState = AppState.get();
            if (currentState) {
                unlockedThemes = currentState.settings.unlockedThemes || [];
                unlockedFeatures = currentState.settings.unlockedFeatures || [];
            }
        } else {
            // AppState only — same convention as the rest of this module. The
            // stats panel renders post-boot, so not-ready just means empty
            // unlock lists this render; the legacy data-access fallback was
            // retired here (review F-004 migration).
            console.warn('⚠️ AppState not ready - rendering rewards with empty unlock data');
        }

        // Convert to milestone format
        const milestoneUnlocks = {
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };

        this.updateThemeMessages(globalCyclesCompleted, milestoneUnlocks);
        // Unlock awarding is handled by cycleCompletion.js - statsPanel is read-only

    }

    /**
     * Update theme unlock messages based on current mode
     * Shows cycle-based text in Cycle mode, task-based text in To-Do mode
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
     * @returns {void}
     */
    updateThemeMessages(globalCyclesCompleted, milestoneUnlocks) {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage } = this.m.elements;

        // Get total tasks cleared and current mode from state
        let totalTasksCleared = 0;
        let isToDoMode = false;
        const AppState = this.m.dependencies.AppState;
        if (AppState?.isReady?.()) {
            const state = AppState.get();
            totalTasksCleared = state?.userProgress?.totalTasksCompleted || 0;
            // Check current mode from active cycle
            const activeCycleId = state?.appState?.activeCycleId;
            const currentCycle = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
            isToDoMode = currentCycle?.deleteCheckedTasks || false;
        }

        // Resolve vtm once — shared across all three message blocks
        const vtm = this.m.dependencies.vocabThemeManager;
        const nextVocabTheme = vtm ? vtm.getNextLockedTheme(globalCyclesCompleted) : null;
        const allVocabUnlocked = vtm ? !nextVocabTheme : false;

        // All unlocked vocabulary theme rewards (excludes 'classic' — always available by default)
        // Updates immediately after checkThemeUnlocks() writes to state before updateStatsPanel() runs
        const expanded = this.m._milestonesExpanded;

        if (themeUnlockMessage) {
            if (vtm) {
                const unlockedIds = vtm.getUnlockedThemeIds()
                    .filter(id => id !== 'classic' && vtm.getThemeDefinition(id) !== null);
                if (unlockedIds.length > 0) {
                    themeUnlockMessage.textContent = unlockedIds.map(id => {
                        const def = vtm.getThemeDefinition(id);
                        // badge (not celebrate) so the list matches the badge row
                        // and the manual — 💪 Fitness, 📚 Scholar (drift-review B-03)
                        const icon = def?.icons?.badge ?? def?.icons?.celebrate ?? '✅';
                        return `${icon} ${def.name}`;
                    }).join('\n');
                    themeUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                    themeUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                } else {
                    themeUnlockMessage.textContent = "";
                    themeUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
                }
            } else {
                themeUnlockMessage.textContent = "";
                themeUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            }
        }

        // Next vocabulary theme to unlock (with emoji)
        if (goldenUnlockMessage) {
            if (vtm) {
                if (nextVocabTheme) {
                    const cyclesNeeded = Math.max(0, nextVocabTheme.unlockAt.cycles - globalCyclesCompleted);
                    const nextIcon = nextVocabTheme.icons?.badge ?? nextVocabTheme.icons?.celebrate ?? '';
                    const cycleWord = getLabel('noun.cycle', { count: cyclesNeeded });
                    const themeUnlockText = getLabel('unlock.nextThemeUnlock', { vars: { name: nextVocabTheme.name, count: cyclesNeeded, cycleWord } });
                    goldenUnlockMessage.textContent = nextIcon ? `${nextIcon} ${themeUnlockText}` : themeUnlockText;
                    goldenUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE);
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                } else {
                    goldenUnlockMessage.textContent = getLabel('unlock.allThemesUnlocked');
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                }
            } else {
                goldenUnlockMessage.textContent = "";
                goldenUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            }
        }

        // Task Order Game — only shown once all vocab themes are unlocked
        if (gameUnlockMessage) {
            if (!allVocabUnlocked) {
                // Still vocab themes to unlock — hide game message entirely
                gameUnlockMessage.textContent = "";
                gameUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            } else if (milestoneUnlocks.taskOrderGame) {
                // No trailing padlock icon — "unlocked!" followed by any lock glyph
                // reads as still-locked (drift-review B-02).
                gameUnlockMessage.textContent = `${getIcon('game')} ${getLabel('unlock.gameUnlocked')}`;
                gameUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                gameUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
            } else {
                if (isToDoMode) {
                    const tasksNeeded = Math.max(0, 500 - totalTasksCleared);
                    const taskWord = getLabel('noun.task', { count: tasksNeeded });
                    gameUnlockMessage.textContent = `${getIcon('locked')} ${getLabel('unlock.game', { vars: { count: tasksNeeded, taskWord } })}`;
                } else {
                    const cyclesNeeded = Math.max(0, 100 - globalCyclesCompleted);
                    const cycleWord = getLabel('noun.cycle', { count: cyclesNeeded });
                    gameUnlockMessage.textContent = `${getIcon('locked')} ${getLabel('unlock.gameCycles', { vars: { count: cyclesNeeded, cycleWord } })}`;
                }
                gameUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE);
                gameUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
            }
        }
    }

    /**
     * Unlock themes if user is eligible based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
     * @returns {Promise<void>}
     */
    async unlockThemesIfEligible(globalCyclesCompleted, milestoneUnlocks) {
        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        const AppState = this.m.dependencies.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for unlockThemesIfEligible');
            return;
        }

        let needsUpdate = false;

        await AppState.update(state => {
            // Ensure arrays exist
            if (!state.settings) state.settings = {};
            if (!state.settings.unlockedThemes) state.settings.unlockedThemes = [];
            if (!state.settings.unlockedFeatures) state.settings.unlockedFeatures = [];
            if (!state.userProgress) state.userProgress = {};
            if (!state.userProgress.rewardMilestones) state.userProgress.rewardMilestones = [];

            // Unlock Task Order Game at 100 GLOBAL cycles
            if (globalCyclesCompleted >= this.m.MILESTONES.TASK_ORDER_GAME && !milestoneUnlocks.taskOrderGame) {
                if (!state.settings.unlockedFeatures.includes("task-order-game")) {
                    state.settings.unlockedFeatures.push("task-order-game");
                    state.userProgress.rewardMilestones.push("task-order-game-100");
                    needsUpdate = true;
                }
            }
        }, true); // Fix #35: needsUpdate evaluated before callback - always save immediately

    }

    /**
     * Handle theme toggle click
     */
    handleThemeToggleClick() {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.m.elements;
        if (!themeUnlockMessage) return;

        // Flip expanded state — use _milestonesExpanded as single source of truth
        const newExpanded = !this.m._milestonesExpanded;
        this.m._milestonesExpanded = newExpanded;

        // Show only elements that have content; always hide when collapsing
        const applyVisible = (el) => {
            if (!el) return;
            if (newExpanded && el.textContent) {
                el.classList.add(DOM_CLASSES.VISIBLE);
            } else {
                el.classList.remove(DOM_CLASSES.VISIBLE);
            }
        };

        applyVisible(themeUnlockMessage);
        applyVisible(goldenUnlockMessage);
        applyVisible(gameUnlockMessage);

        // Update toggle arrow and ARIA
        const toggleIcon = themeUnlockStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
        if (toggleIcon) toggleIcon.textContent = newExpanded ? "▲" : "▼";

        const clickableHeader = themeUnlockStatus?.querySelector(DOM_SELECTORS.CLICKABLE);
        if (clickableHeader) clickableHeader.setAttribute('aria-expanded', String(newExpanded));

        this.m.saveCollapsiblePreference('milestonesExpanded', newExpanded);
    }

    /**
     * Handle Current Routine toggle click
     */
    openThemesPanel() {
        if (this.m.elements.themesModal) {
            this.m.elements.themesModal._previousFocus = this.m.rawDeps.getActiveElement();
            if (!this.m.elements.themesModal.open) this.m.elements.themesModal.showModal();
            this.m.dependencies.hideMainMenu();
        }
    }

    /**
     * Close themes panel
     */
    closeThemesPanel() {
        if (this.m.elements.themesModal?.open) {
            this.m.elements.themesModal.close();
            this.m.elements.themesModal._previousFocus?.focus({ focusVisible: false });
        }
    }

    // ==========================================
    // 📜 HISTORY & ACHIEVEMENTS MODAL METHODS
    // ==========================================

    /**
     * Open the history modal
     */
}
