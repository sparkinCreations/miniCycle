/**
 * 🎮 miniCycle Games Manager (DI-Pure)
 * Manages mini-game unlocking and panel interactions
 *
 * Features:
 * - Check game unlock status via AppState
 * - Unlock games and update AppState
 * - Modal panel interactions with click-outside-to-close
 *
 * Note: document.*, window.location are browser APIs, not dependencies.
 *
 * @module gamesManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('GamesManager', {
    appInit: optional(null),
    AppState: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null),
    getModal: optional(null),
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, safeAddEventListener: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for GamesManager (call before init)
 * @param {Object} dependencies - { AppState, safeAddEventListener }
 */
export function setGamesManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

class GamesManager {
    constructor(dependencies = {}) {
        // For singleton created at module load time, use getter for late-binding
        this.initialized = false;

        // Instance version - late-binding via getter
        Object.defineProperty(this, 'version', {
            get: () => di.resolve().AppMeta?.version
        });

        // Use getter for late-binding (singleton created before deps set)
        // IMPORTANT: Don't pass dependencies to resolve() - use injected deps from setDependencies
        Object.defineProperty(this, 'deps', {
            get: () => {
                const resolvedDeps = di.resolve();
                return {
                    AppState: resolvedDeps.AppState,
                    safeAddEventListener: resolvedDeps.safeAddEventListener,
                    getModal: resolvedDeps.getModal
                };
            }
        });
    }

    /**
     * Get AppState (deferred lookup for late binding, DI-pure)
     * Reads from _deps directly to preserve lazy getter resolution
     * @private
     */
    _getAppState() {
        return _deps.AppState;  // Read from module-level _deps to preserve lazy getter
    }

    async init() {
        await _deps.appInit?.waitForCore();

        this.setupEventListeners();
        this.populateGamesPanelContent();

        // Defer checkGamesUnlock until AppState is ready
        this.deferredCheckGamesUnlock();

        this.initialized = true;
    }

    /**
     * Populate games panel DOM content from label system
     */
    populateGamesPanelContent() {
        const titleEl = document.getElementById('games-panel-title');
        if (titleEl) {
            titleEl.textContent = `🎮 ${getLabel('games.title')}`;
        }

        const contentEl = document.querySelector(DOM_SELECTORS.GAMES_MODAL_CONTENT);
        if (contentEl) {
            const descP = contentEl.querySelector('p');
            if (descP) {
                descP.textContent = getLabel('games.description');
            }
        }

        const playBtn = document.getElementById(DOM_IDS.OPEN_TASK_ORDER_GAME);
        if (playBtn) {
            playBtn.textContent = getLabel('games.play');
        }
    }

    /**
     * Check games unlock after AppState is ready (deferred)
     */
    async deferredCheckGamesUnlock() {
        // Wait for AppState to be ready
        // Note: For new users, data is created in Phase 3 which may take longer
        const maxAttempts = 150;  // 15 seconds max (150 × 100ms)
        let attempts = 0;

        this._deferredCheckInterval = setInterval(() => {
            attempts++;

            const AppState = this._getAppState();
            if (AppState?.isReady?.()) {
                clearInterval(this._deferredCheckInterval);
                this._deferredCheckInterval = null;
                this.checkGamesUnlock();
            } else if (attempts >= maxAttempts) {
                clearInterval(this._deferredCheckInterval);
                this._deferredCheckInterval = null;
                console.warn('⚠️ AppState never became ready for checkGamesUnlock (this is normal for new users until cycle is created)');
            }
        }, 100); // Check every 100ms
    }

    /**
     * Check if games are unlocked and show/hide menu accordingly
     */
    checkGamesUnlock() {
        const AppState = this._getAppState();

        // Silently return if AppState isn't ready yet (deferred check will retry)
        if (!AppState?.isReady?.()) {
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for checkGamesUnlock');
            return;
        }

        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        const hasGameUnlock = unlockedFeatures.includes("task-order-game");

        const gamesMenuOption = document.getElementById(DOM_IDS.GAMES_MENU_OPTION);
        if (gamesMenuOption) {
            gamesMenuOption.style.display = hasGameUnlock ? "block" : "none";
        }
    }

    /**
     * Unlock the mini game and update AppState
     */
    unlockMiniGame() {

        const AppState = this._getAppState();

        if (!AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for unlockMiniGame');
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for unlockMiniGame');
            return;
        }

        const unlockedFeatures = currentState.settings?.unlockedFeatures || [];
        if (!unlockedFeatures.includes("task-order-game")) {
            AppState.update(state => {
                if (!state.settings.unlockedFeatures) {
                    state.settings.unlockedFeatures = [];
                }
                state.settings.unlockedFeatures.push("task-order-game");
                state.userProgress.rewardMilestones.push("task-order-game-100");
            }, true);

        }

        this.checkGamesUnlock();
    }

    /**
     * Set up click-outside-to-close behavior for games modal
     */
    setupGamesModalOutsideClick() {
        const gamesPanel = this.deps.getModal('games');
        const gamesContent = document.querySelector(DOM_SELECTORS.GAMES_MODAL_CONTENT);
        const openButton = document.getElementById(DOM_IDS.OPEN_GAMES_PANEL);

        if (!gamesPanel || !gamesContent || !openButton) {
            console.warn('⚠️ Games panel elements not found');
            return;
        }

        // ✅ FIX: Only set up handler once - reuse stored reference to prevent accumulation
        if (this._gamesOutsideClickHandler) {
            return;
        }

        // ✅ FIX: Store handler as instance property for reuse
        this._gamesOutsideClickHandler = (event) => {
            const isOpen = gamesPanel.open;
            const clickedOutside =
                !gamesContent.contains(event.target) &&
                event.target !== openButton;

            if (isOpen && clickedOutside) {
                gamesPanel.close();
                gamesPanel._previousFocus?.focus({ focusVisible: false });
            }
        };

        // Use safeAddEventListener if available (DI-pure, no window.* fallback)
        if (this.deps.safeAddEventListener) {
            this.deps.safeAddEventListener(document, "click", this._gamesOutsideClickHandler);
        } else {
            document.addEventListener("click", this._gamesOutsideClickHandler);
        }
    }

    /**
     * Set up all event listeners for games panel
     */
    setupEventListeners() {
        // ✅ Idempotency guard
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        const safeAdd = this.deps.safeAddEventListener;

        // Open games panel
        const openButton = document.getElementById(DOM_IDS.OPEN_GAMES_PANEL);
        if (openButton) {
            openButton._clickHandler = () => {
                const gamesPanel = this.deps.getModal('games');
                if (gamesPanel) {
                    gamesPanel._previousFocus = document.activeElement;
                    if (!gamesPanel.open) gamesPanel.showModal();
                    this.setupGamesModalOutsideClick();
                }
            };
            safeAdd(openButton, "click", openButton._clickHandler);
        }

        // Close games panel
        const closeButton = document.getElementById(DOM_IDS.CLOSE_GAMES_PANEL);
        if (closeButton) {
            closeButton._clickHandler = () => {
                const gamesPanel = this.deps.getModal('games');
                if (gamesPanel) {
                    gamesPanel.close();
                    gamesPanel._previousFocus?.focus({ focusVisible: false });
                }
            };
            safeAdd(closeButton, "click", closeButton._clickHandler);
        }

        // Restore focus when dialog closes (including native ESC)
        const gamesPanel = this.deps.getModal('games');
        if (gamesPanel) {
            this._gamesPanelCloseHandler = () => {
                gamesPanel._previousFocus?.focus({ focusVisible: false });
                // Remove outside-click handler when modal closes (re-added on next open)
                if (this._gamesOutsideClickHandler) {
                    document.removeEventListener('click', this._gamesOutsideClickHandler);
                    this._gamesOutsideClickHandler = null;
                }
            };
            safeAdd(gamesPanel, "close", this._gamesPanelCloseHandler);
        }

        // Open task order game (redirect to game HTML)
        const gameButton = document.getElementById(DOM_IDS.OPEN_TASK_ORDER_GAME);
        if (gameButton) {
            gameButton._clickHandler = () => {
                window.location.href = "games/miniCycle-taskOrder.html";
            };
            safeAdd(gameButton, "click", gameButton._clickHandler);
        }

    }

    /**
     * Clean up event listeners and timers
     */
    destroy() {
        // Clear deferred check interval
        if (this._deferredCheckInterval) {
            clearInterval(this._deferredCheckInterval);
            this._deferredCheckInterval = null;
        }

        // Remove document-level outside-click handler
        if (this._gamesOutsideClickHandler) {
            document.removeEventListener('click', this._gamesOutsideClickHandler);
            this._gamesOutsideClickHandler = null;
        }

        // Remove button click handlers
        const openButton = document.getElementById(DOM_IDS.OPEN_GAMES_PANEL);
        if (openButton?._clickHandler) {
            openButton.removeEventListener('click', openButton._clickHandler);
            openButton._clickHandler = null;
        }

        const closeButton = document.getElementById(DOM_IDS.CLOSE_GAMES_PANEL);
        if (closeButton?._clickHandler) {
            closeButton.removeEventListener('click', closeButton._clickHandler);
            closeButton._clickHandler = null;
        }

        const gameButton = document.getElementById(DOM_IDS.OPEN_TASK_ORDER_GAME);
        if (gameButton?._clickHandler) {
            gameButton.removeEventListener('click', gameButton._clickHandler);
            gameButton._clickHandler = null;
        }

        // Remove games panel close handler
        const gamesPanel = this.deps.getModal('games');
        if (gamesPanel && this._gamesPanelCloseHandler) {
            gamesPanel.removeEventListener('close', this._gamesPanelCloseHandler);
            this._gamesPanelCloseHandler = null;
        }

        this._eventListenersInitialized = false;
    }
}

// Create single instance
const gamesManager = new GamesManager();

/**
 * Initialize GamesManager (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {GamesManager} The singleton instance
 */
export async function initGamesManager(dependencies = {}) {
    // Set dependencies
    setGamesManagerDependencies(dependencies);

    // Initialize the manager
    await gamesManager.init();

    return gamesManager;
}

// DI-pure module (no window.* fallbacks for dependencies)

// Named exports only (no default export)
// Note: initGamesManager is already exported via 'export async function' declaration
export { GamesManager, gamesManager };
