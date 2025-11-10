/**
 * 🎮 miniCycle Games Manager
 * Manages mini-game unlocking and panel interactions
 *
 * Features:
 * - Check game unlock status via AppState
 * - Unlock games and update AppState
 * - Modal panel interactions with click-outside-to-close
 *
 * Dependencies:
 * - window.AppState (state manager)
 * - appInit (initialization system)
 * - DOM elements (games-panel, games-menu-option)
 *
 * @module gamesManager
 * @version 1.347
 */

import { appInit } from '../appInitialization.js';

export class GamesManager {
    constructor() {
        this.version = '1.347';
        this.initialized = false;
    }

    async init() {
        await appInit.waitForCore();

        this.setupEventListeners();

        // Defer checkGamesUnlock until AppState is ready
        this.deferredCheckGamesUnlock();

        this.initialized = true;
        console.log('🎮 Games Manager initialized');
    }

    /**
     * Check games unlock after AppState is ready (deferred)
     */
    async deferredCheckGamesUnlock() {
        // Wait for AppState to be ready
        const maxAttempts = 50;
        let attempts = 0;

        const checkInterval = setInterval(() => {
            attempts++;

            if (window.AppState?.isReady?.()) {
                clearInterval(checkInterval);
                this.checkGamesUnlock();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('⚠️ AppState never became ready for checkGamesUnlock');
            }
        }, 100); // Check every 100ms
    }

    /**
     * Check if games are unlocked and show/hide menu accordingly
     */
    checkGamesUnlock() {
        // Silently return if AppState isn't ready yet (deferred check will retry)
        if (!window.AppState?.isReady?.()) {
            return;
        }

        console.log('🎮 Checking games unlock (Schema 2.5 only)...');

        const currentState = window.AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for checkGamesUnlock');
            return;
        }

        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");

        console.log('🔍 Game unlock status:', hasGameUnlock);

        const gamesMenuOption = document.getElementById("games-menu-option");
        if (gamesMenuOption) {
            gamesMenuOption.style.display = hasGameUnlock ? "block" : "none";
            console.log(hasGameUnlock ? '✅ Games menu displayed' : '🔒 Games still locked');
        }
    }

    /**
     * Unlock the mini game and update AppState
     */
    unlockMiniGame() {
        console.log('🎮 Unlocking mini game (state-based)...');

        if (!window.AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for unlockMiniGame');
            return;
        }

        const currentState = window.AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for unlockMiniGame');
            return;
        }

        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        if (!unlockedFeatures.includes("task-order-game")) {
            window.AppState.update(state => {
                if (!state.settings.unlockedFeatures) {
                    state.settings.unlockedFeatures = [];
                }
                state.settings.unlockedFeatures.push("task-order-game");
                state.userProgress.rewardMilestones.push("task-order-game-100");
            }, true);

            console.log("🎮 Task Order Game unlocked (state-based)!");
        }

        this.checkGamesUnlock();
    }

    /**
     * Set up click-outside-to-close behavior for games modal
     */
    setupGamesModalOutsideClick() {
        const gamesPanel = document.getElementById("games-panel");
        const gamesContent = document.querySelector(".games-modal-content");
        const openButton = document.getElementById("open-games-panel");

        if (!gamesPanel || !gamesContent || !openButton) {
            console.warn('⚠️ Games panel elements not found');
            return;
        }

        console.log("✅ Games outside click ready");

        const handleClickOutside = (event) => {
            const isOpen = gamesPanel.style.display === "flex";
            const clickedOutside =
                !gamesContent.contains(event.target) &&
                event.target !== openButton;

            if (isOpen && clickedOutside) {
                gamesPanel.style.display = "none";
            }
        };

        // Use window.safeAddEventListener if available, fallback to regular
        if (window.safeAddEventListener) {
            window.safeAddEventListener(document, "click", handleClickOutside);
        } else {
            document.addEventListener("click", handleClickOutside);
        }
    }

    /**
     * Set up all event listeners for games panel
     */
    setupEventListeners() {
        // Open games panel
        const openButton = document.getElementById("open-games-panel");
        if (openButton) {
            openButton.addEventListener("click", () => {
                const gamesPanel = document.getElementById("games-panel");
                if (gamesPanel) {
                    gamesPanel.style.display = "flex";
                    this.setupGamesModalOutsideClick();
                }
            });
        }

        // Close games panel
        const closeButton = document.getElementById("close-games-panel");
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                const gamesPanel = document.getElementById("games-panel");
                if (gamesPanel) {
                    gamesPanel.style.display = "none";
                }
            });
        }

        // Open task order game (redirect to game HTML)
        const gameButton = document.getElementById("open-task-order-game");
        if (gameButton) {
            gameButton.addEventListener("click", () => {
                window.location.href = "miniCycleGames/miniCycle-taskOrder.html";
            });
        }

        console.log('✅ Games event listeners attached');
    }
}

// Create single instance
const gamesManager = new GamesManager();

// Expose for testing
window.GamesManager = GamesManager;
window.gamesManager = gamesManager;

// Global wrappers for backward compatibility
window.checkGamesUnlock = () => gamesManager.checkGamesUnlock();
window.unlockMiniGame = () => gamesManager.unlockMiniGame();

// Initialize automatically after import
gamesManager.init();

console.log('✅ Games Manager module loaded');
