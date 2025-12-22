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

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('GamesManager', {
    appInit: optional(null),
    AppState: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
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
    console.log('🎮 GamesManager dependencies set:', Object.keys(dependencies));
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
                    safeAddEventListener: resolvedDeps.safeAddEventListener
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
        // Note: For new users, data is created in Phase 3 which may take longer
        const maxAttempts = 150;  // 15 seconds max (150 × 100ms)
        let attempts = 0;

        const checkInterval = setInterval(() => {
            attempts++;

            const AppState = this._getAppState();
            if (AppState?.isReady?.()) {
                clearInterval(checkInterval);
                this.checkGamesUnlock();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
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

        console.log('🎮 Checking games unlock (Schema 2.5 only)...');

        const currentState = AppState.get();
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

        // ✅ FIX: Only set up handler once - reuse stored reference to prevent accumulation
        if (this._gamesOutsideClickHandler) {
            console.log('✅ Games outside click already set up');
            return;
        }

        console.log("✅ Games outside click ready");

        // ✅ FIX: Store handler as instance property for reuse
        this._gamesOutsideClickHandler = (event) => {
            const isOpen = gamesPanel.style.display === "flex";
            const clickedOutside =
                !gamesContent.contains(event.target) &&
                event.target !== openButton;

            if (isOpen && clickedOutside) {
                gamesPanel.style.display = "none";
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
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });

        // Open games panel
        const openButton = document.getElementById("open-games-panel");
        if (openButton) {
            openButton._clickHandler = () => {
                const gamesPanel = document.getElementById("games-panel");
                if (gamesPanel) {
                    gamesPanel.style.display = "flex";
                    this.setupGamesModalOutsideClick();
                }
            };
            safeAdd(openButton, "click", openButton._clickHandler);
        }

        // Close games panel
        const closeButton = document.getElementById("close-games-panel");
        if (closeButton) {
            closeButton._clickHandler = () => {
                const gamesPanel = document.getElementById("games-panel");
                if (gamesPanel) {
                    gamesPanel.style.display = "none";
                }
            };
            safeAdd(closeButton, "click", closeButton._clickHandler);
        }

        // Open task order game (redirect to game HTML)
        const gameButton = document.getElementById("open-task-order-game");
        if (gameButton) {
            gameButton._clickHandler = () => {
                window.location.href = "games/miniCycle-taskOrder.html";
            };
            safeAdd(gameButton, "click", gameButton._clickHandler);
        }

        console.log('✅ Games event listeners attached');
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

    console.log('✅ GamesManager initialized via initGamesManager');
    return gamesManager;
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎮 Games Manager module loaded (DI-pure, awaiting init)');

// Note: initGamesManager is already exported via 'export async function' declaration
export default GamesManager;
export { gamesManager };
