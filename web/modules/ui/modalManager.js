/**
 * 🎭 miniCycle Modal Manager
 * Centralized modal management and coordination
 *
 * Features:
 * - Global modal close functionality
 * - ESC key handling for all modals
 * - Click-outside-to-close behavior
 * - Individual modal setup (feedback, about, settings, reminders)
 * - Modal state tracking
 *
 * Dependencies (injected via setModalManagerDependencies):
 * - hideMainMenu (menu management)
 * - showNotification (notifications)
 * - sanitizeInput (input sanitization)
 * - safeAddEventListener (event listener helper)
 * - waitForCore (initialization wait function)
 *
 * @module modalManager
 * @version 1.394
 */

// Module-level dependencies - set via setModalManagerDependencies
let _deps = {
    showNotification: null,
    hideMainMenu: null,
    sanitizeInput: null,
    safeAddEventListener: null,
    waitForCore: null
};

/**
 * Set dependencies for ModalManager
 * Call this after dependencies are available
 */
export function setModalManagerDependencies(deps) {
    if (deps.showNotification) _deps.showNotification = deps.showNotification;
    if (deps.hideMainMenu) _deps.hideMainMenu = deps.hideMainMenu;
    if (deps.sanitizeInput) _deps.sanitizeInput = deps.sanitizeInput;
    if (deps.safeAddEventListener) _deps.safeAddEventListener = deps.safeAddEventListener;
    if (deps.waitForCore) _deps.waitForCore = deps.waitForCore;
    console.log('🎭 ModalManager dependencies injected');
}

export class ModalManager {
    constructor(dependencies = {}) {
        // Merge module-level deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = mergedDeps.AppMeta?.version;
        this.initialized = false;

        // Store injected dependencies
        this._injectedDeps = dependencies;

        // Dependency injection - no window.* fallbacks
        // Priority: module-level _deps → instance _injectedDeps
        Object.defineProperty(this, 'deps', {
            get: () => ({
                showNotification: _deps.showNotification || this._injectedDeps.showNotification || this.fallbackNotification.bind(this),
                hideMainMenu: _deps.hideMainMenu || this._injectedDeps.hideMainMenu || null,
                sanitizeInput: _deps.sanitizeInput || this._injectedDeps.sanitizeInput || null,
                safeAddEventListener: _deps.safeAddEventListener || this._injectedDeps.safeAddEventListener || null,
                waitForCore: _deps.waitForCore || this._injectedDeps.waitForCore || (() => Promise.resolve())
            })
        });
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
        console.log(`[ModalManager] ${type.toUpperCase()}: ${message}`);
    }

    async init() {
        await this.deps.waitForCore();

        this.setupEventListeners();

        this.initialized = true;
        console.log('🎭 Modal Manager initialized');
    }

    /**
     * Set up all modal event listeners
     */
    setupEventListeners() {
        this.setupFeedbackModal();
        this.setupAboutModal();
        this.setupSettingsModalClickOutside();
        this.setupRemindersModalHandlers();
        this.setupGlobalKeyHandlers();

        console.log('✅ Modal event listeners attached');
    }

    /**
     * Close all modals and overlays in the app
     */
    closeAllModals() {
        // Close Schema 2.5 and legacy modals
        const modalSelectors = [
            "[data-modal]",
            ".settings-modal",
            ".mini-cycle-switch-modal",
            "#feedback-modal",
            "#about-modal",
            "#themes-modal",
            "#games-panel",
            "#reminders-modal",
            "#testing-modal",
            "#recurring-panel-overlay",
            "#storage-viewer-overlay",
            ".mini-modal-overlay",
            ".miniCycle-overlay",
            ".onboarding-modal"
        ];

        modalSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(modal => {
                // Special handling for different modal types
                if (modal.dataset.modal !== undefined || modal.classList.contains("menu-container")) {
                    modal.classList.remove("visible");
                } else if (modal.id === "recurring-panel-overlay" || modal.id === "storage-viewer-overlay") {
                    modal.classList.add("hidden");
                } else {
                    modal.style.display = "none";
                }
            });
        });

        // Close task options
        document.querySelectorAll(".task-options").forEach(action => {
            action.style.opacity = "0";
            action.style.visibility = "hidden";
            action.style.pointerEvents = "none";
        });

        // Reset task states
        document.querySelectorAll(".task").forEach(task => {
            task.classList.remove("long-pressed", "draggable", "dragging", "selected");
        });

        // Clear any active selections in recurring panels
        document.querySelectorAll(".recurring-task-item.selected").forEach(item => {
            item.classList.remove("selected");
        });

        // Hide recurring settings panel if open
        const recurringSettingsPanel = document.getElementById("recurring-settings-panel");
        if (recurringSettingsPanel) {
            recurringSettingsPanel.classList.add("hidden");
        }
    }

    /**
     * Set up feedback modal
     */
    setupFeedbackModal() {
        const feedbackModal = document.getElementById("feedback-modal");
        const openFeedbackBtn = document.getElementById("open-feedback-modal");
        const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
        const feedbackForm = document.getElementById("feedback-form");
        const feedbackText = document.getElementById("feedback-text");
        const submitButton = document.getElementById("submit-feedback");
        const thankYouMessage = document.getElementById("thank-you-message");

        if (!feedbackModal || !openFeedbackBtn || !closeFeedbackBtn) {
            console.warn('⚠️ Feedback modal elements not found');
            return;
        }

        // Open Modal
        openFeedbackBtn.addEventListener("click", () => {
            feedbackModal.style.display = "flex";
            if (this.deps.hideMainMenu) {
                this.deps.hideMainMenu();
            }
            if (thankYouMessage) {
                thankYouMessage.style.display = "none";
            }
        });

        // Close Modal
        closeFeedbackBtn.addEventListener("click", () => {
            feedbackModal.style.display = "none";
        });

        // Close Modal on Outside Click
        window.addEventListener("click", (event) => {
            if (event.target === feedbackModal) {
                feedbackModal.style.display = "none";
            }
        });

        // Handle Form Submission via AJAX (Prevent Page Refresh)
        if (feedbackForm) {
            feedbackForm.addEventListener("submit", (event) => {
                event.preventDefault(); // Prevent default form submission

                // Disable button while sending
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = "Sending...";
                }

                // Prepare Form Data
                const formData = new FormData(feedbackForm);

                // Send request to Web3Forms API
                fetch("https://api.web3forms.com/submit", {
                    method: "POST",
                    body: formData,
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Show Thank You Message
                        if (thankYouMessage) {
                            thankYouMessage.style.display = "block";
                        }

                        // Clear Textarea
                        if (feedbackText) {
                            feedbackText.value = "";
                        }

                        // Hide Form After Submission
                        setTimeout(() => {
                            if (thankYouMessage) {
                                thankYouMessage.style.display = "none";
                            }
                            feedbackModal.style.display = "none";
                        }, 2000);
                    } else {
                        this.deps.showNotification("❌ Error sending feedback. Please try again.", "error");
                    }
                })
                .catch(error => {
                    this.deps.showNotification("❌ Network error. Please try again later.", "error");
                })
                .finally(() => {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = "Submit";
                    }
                });
            });
        }

        // Setup footer feedback button
        this.setupFeedbackFooterButton();
    }

    /**
     * Set up footer feedback button
     */
    setupFeedbackFooterButton() {
        const openFeedbackFooter = document.getElementById("open-feedback-modal-footer");
        const feedbackModal = document.getElementById("feedback-modal");
        const thankYouMessage = document.getElementById("thank-you-message");

        if (openFeedbackFooter && feedbackModal) {
            openFeedbackFooter.addEventListener("click", () => {
                feedbackModal.style.display = "flex";
                if (thankYouMessage) {
                    thankYouMessage.style.display = "none";
                }
            });
        }
    }

    /**
     * Set up about modal
     */
    setupAboutModal() {
        const aboutModal = document.getElementById("about-modal");
        const openAboutBtn = document.getElementById("open-about-modal");

        if (!aboutModal || !openAboutBtn) {
            console.warn('⚠️ About modal elements not found');
            return;
        }

        const closeAboutBtn = aboutModal.querySelector(".close-modal");

        // Open Modal
        openAboutBtn.addEventListener("click", () => {
            aboutModal.style.display = "flex";
        });

        // Close Modal
        if (closeAboutBtn) {
            closeAboutBtn.addEventListener("click", () => {
                aboutModal.style.display = "none";
            });
        }

        // Close Modal on Outside Click
        window.addEventListener("click", (event) => {
            if (event.target === aboutModal) {
                aboutModal.style.display = "none";
            }
        });
    }

    /**
     * Set up settings modal click-outside behavior
     * Note: Main settings modal setup is in setupSettingsMenu()
     * This only handles the click-outside-to-close logic
     */
    setupSettingsModalClickOutside() {
        const settingsModal = document.querySelector(".settings-modal");
        const settingsModalContent = document.querySelector(".settings-modal-content");
        const openSettingsBtn = document.getElementById("open-settings");

        if (!settingsModal || !settingsModalContent || !openSettingsBtn) {
            console.warn('⚠️ Settings modal elements not found');
            return;
        }

        // This is handled in setupSettingsMenu, but we track it here for closeAllModals
        console.log('✅ Settings modal tracked by modal manager');
    }

    /**
     * Set up reminders modal close handlers
     */
    setupRemindersModalHandlers() {
        const remindersModal = document.getElementById("reminders-modal");
        const closeRemindersBtn = document.getElementById("close-reminders-btn");

        if (!remindersModal || !closeRemindersBtn) {
            console.warn('⚠️ Reminders modal elements not found');
            return;
        }

        // Close button
        closeRemindersBtn.addEventListener("click", () => {
            remindersModal.style.display = "none";
        });

        // Click outside to close
        window.addEventListener("click", (event) => {
            if (event.target === remindersModal) {
                remindersModal.style.display = "none";
            }
        });
    }

    /**
     * Set up global keyboard handlers (ESC key)
     */
    setupGlobalKeyHandlers() {
        if (this.deps.safeAddEventListener) {
            this.deps.safeAddEventListener(document, "keydown", (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    this.closeAllModals();

                    // Also clear any notification focus
                    const notifications = document.querySelectorAll(".notification");
                    notifications.forEach(notification => {
                        if (notification.querySelector(".close-btn")) {
                            notification.querySelector(".close-btn").click();
                        }
                    });

                    // Return focus to task input
                    const taskInput = document.getElementById("new-task-input");
                    if (taskInput) {
                        setTimeout(() => taskInput.focus(), 100);
                    }
                }
            });

            console.log('✅ Global ESC key handler attached');
        } else {
            console.warn('⚠️ safeAddEventListener not available for global key handlers');
        }
    }

    /**
     * Check if any modal is currently open
     * @returns {boolean} True if any modal is open
     */
    isModalOpen() {
        const modalSelectors = [
            ".settings-modal[style*='display: flex']",
            ".mini-cycle-switch-modal[style*='display: flex']",
            "#feedback-modal[style*='display: flex']",
            "#about-modal[style*='display: flex']",
            "#themes-modal[style*='display: flex']",
            "#games-panel[style*='display: flex']",
            "#reminders-modal[style*='display: flex']",
            "#testing-modal[style*='display: flex']",
            ".mini-modal-overlay",
            ".miniCycle-overlay",
            ".onboarding-modal:not([style*='display: none'])"
        ];

        return modalSelectors.some(selector => {
            const elements = document.querySelectorAll(selector);
            return elements.length > 0;
        });
    }
}

// Module-level instance (created but NOT auto-initialized)
let modalManager = null;

/**
 * Initialize the ModalManager module
 * @param {Object} dependencies - Dependency injection object
 * @returns {ModalManager} The initialized ModalManager instance
 */
export async function initModalManager(dependencies = {}) {
    if (modalManager && modalManager.initialized) {
        console.warn('⚠️ ModalManager already initialized');
        return modalManager;
    }

    // Set dependencies first
    setModalManagerDependencies(dependencies);

    // Create instance and initialize
    modalManager = new ModalManager(dependencies);
    await modalManager.init();

    console.log('✅ ModalManager instance created and initialized');
    return modalManager;
}

/**
 * Get the ModalManager instance (for access after initialization)
 * @returns {ModalManager|null}
 */
export function getModalManager() {
    return modalManager;
}

// Phase 3 - Clean exports (no window.* pollution, no auto-init)
console.log('✅ Modal Manager module loaded (Phase 3 - no window.* exports, no auto-init)');

export default ModalManager;
export { modalManager };
