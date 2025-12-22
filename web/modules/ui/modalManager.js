/**
 * 🎭 miniCycle Modal Manager (DI-Pure)
 * Centralized modal management and coordination
 *
 * Features:
 * - Global modal close functionality
 * - ESC key handling for all modals
 * - Click-outside-to-close behavior
 * - Individual modal setup (feedback, about, settings, reminders)
 * - Modal state tracking
 *
 * @module modalManager
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('ModalManager', {
    showNotification: optional(null),
    hideMainMenu: optional(null),
    sanitizeInput: optional(null),
    safeAddEventListener: optional(null),
    waitForCore: optional(() => Promise.resolve()),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for ModalManager
 * Call this after dependencies are available
 */
export function setModalManagerDependencies(deps) {
    di.setDependencies(deps);
    console.log('🎭 ModalManager dependencies injected');
}

export class ModalManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;
        this.initialized = false;

        // Store resolved dependencies
        this.deps = {
            showNotification: resolvedDeps.showNotification || this.fallbackNotification.bind(this),
            hideMainMenu: resolvedDeps.hideMainMenu,
            sanitizeInput: resolvedDeps.sanitizeInput,
            safeAddEventListener: resolvedDeps.safeAddEventListener,
            waitForCore: resolvedDeps.waitForCore || (() => Promise.resolve())
        };
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
        // ✅ FIX: Idempotency guard to prevent duplicate listeners
        if (this._eventListenersInitialized) {
            console.log('✅ Modal event listeners already set up');
            return;
        }
        this._eventListenersInitialized = true;

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

        // Use safeAddEventListener to prevent duplicate listeners
        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });

        // Open Modal
        openFeedbackBtn._clickHandler = () => {
            feedbackModal.style.display = "flex";
            if (this.deps.hideMainMenu) {
                this.deps.hideMainMenu();
            }
            if (thankYouMessage) {
                thankYouMessage.style.display = "none";
            }
        };
        safeAdd(openFeedbackBtn, "click", openFeedbackBtn._clickHandler);

        // Close Modal
        closeFeedbackBtn._clickHandler = () => {
            feedbackModal.style.display = "none";
        };
        safeAdd(closeFeedbackBtn, "click", closeFeedbackBtn._clickHandler);

        // Close Modal on Outside Click
        feedbackModal._outsideClickHandler = (event) => {
            if (event.target === feedbackModal) {
                feedbackModal.style.display = "none";
            }
        };
        safeAdd(window, "click", feedbackModal._outsideClickHandler);

        // Handle Form Submission via AJAX (Prevent Page Refresh)
        if (feedbackForm) {
            feedbackForm._submitHandler = (event) => {
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
            };
            safeAdd(feedbackForm, "submit", feedbackForm._submitHandler);
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
            const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
            openFeedbackFooter._clickHandler = () => {
                feedbackModal.style.display = "flex";
                if (thankYouMessage) {
                    thankYouMessage.style.display = "none";
                }
            };
            safeAdd(openFeedbackFooter, "click", openFeedbackFooter._clickHandler);
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

        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
        const closeAboutBtn = aboutModal.querySelector(".close-modal");

        // Open Modal
        openAboutBtn._clickHandler = () => {
            aboutModal.style.display = "flex";
        };
        safeAdd(openAboutBtn, "click", openAboutBtn._clickHandler);

        // Close Modal
        if (closeAboutBtn) {
            closeAboutBtn._clickHandler = () => {
                aboutModal.style.display = "none";
            };
            safeAdd(closeAboutBtn, "click", closeAboutBtn._clickHandler);
        }

        // Close Modal on Outside Click
        aboutModal._outsideClickHandler = (event) => {
            if (event.target === aboutModal) {
                aboutModal.style.display = "none";
            }
        };
        safeAdd(window, "click", aboutModal._outsideClickHandler);
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

        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });

        // Close button
        closeRemindersBtn._clickHandler = () => {
            remindersModal.style.display = "none";
        };
        safeAdd(closeRemindersBtn, "click", closeRemindersBtn._clickHandler);

        // Click outside to close
        remindersModal._outsideClickHandler = (event) => {
            if (event.target === remindersModal) {
                remindersModal.style.display = "none";
            }
        };
        safeAdd(window, "click", remindersModal._outsideClickHandler);
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
