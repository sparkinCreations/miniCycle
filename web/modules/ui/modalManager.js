/**
 * miniCycle Modal Manager (DI-Pure)
 *
 * Centralized modal management and coordination.
 * Handles all modal dialogs in the application.
 *
 * Uses native <dialog> API (.showModal()/.close()) for modals that have been
 * converted to <dialog> elements, with legacy fallbacks for non-dialog elements.
 * Focus trapping and ESC handling are provided natively by the <dialog> element.
 *
 * Features:
 * - Global modal close functionality
 * - Click-outside-to-close behavior (via backdrop click on <dialog>)
 * - Individual modal setup (feedback, about, settings, reminders)
 * - Modal state tracking
 * - Prompt and confirmation modal APIs
 *
 * @module ui/modalManager
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} PromptModalConfig
 * @property {string} [title=''] - Modal title
 * @property {string} message - Prompt message
 * @property {string} [placeholder=''] - Input placeholder
 * @property {string} [defaultValue=''] - Default input value
 * @property {string} [confirmText='OK'] - Confirm button text
 * @property {string} [cancelText='Cancel'] - Cancel button text
 * @property {boolean} [required=false] - Whether input is required
 * @property {Function} callback - Called with input value or null if cancelled
 */

/**
 * @typedef {Object} ConfirmationModalConfig
 * @property {string} [title=''] - Modal title
 * @property {string} message - Confirmation message
 * @property {string} [confirmText='Confirm'] - Confirm button text
 * @property {string} [cancelText='Cancel'] - Cancel button text
 * @property {Function} callback - Called with boolean (true if confirmed)
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { MODAL_NAMES, MODAL_DEFS } from './modalRegistry.js';
import { getLabel } from '../labels/labelResolver.js';

// Import for local use within this module
import { hasActiveNotifications, isClickOnNotification } from './modalUtils.js';

// Re-export so existing DI consumers that reference modalManager exports still work.
export { hasActiveNotifications, isClickOnNotification };

import { animateDialogClose } from '../utils/dialogClose.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('ModalManager', {
    showNotification: optional(null),
    hideMainMenu: optional(null),
    sanitizeInput: optional(null),
    safeAddEventListener: optional(null),
    waitForCore: optional(() => Promise.resolve()),
    AppMeta: optional(null),
    getModal: optional(null)
});

// Late-binding deps via Proxy
/** @type {{showNotification: Function|null, hideMainMenu: Function|null, sanitizeInput: Function|null, safeAddEventListener: Function|null, waitForCore: Function, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for ModalManager
 * Call this after dependencies are available
 * @returns {void}
 */
export function setModalManagerDependencies(deps) {
    di.setDependencies(deps);
}

function replaceStoredEventListener(element, event, key, handler, options) {
    if (!element) return;

    if (typeof element[key] === 'function') {
        element.removeEventListener(event, element[key], options);
    }

    element[key] = handler;
    element.addEventListener(event, handler, options);
}

/**
 * Coordinates modal lifecycle including open/close, focus trapping,
 * backdrop clicks, escape key handling, and cleanup of event listeners.
 */
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
    }

    async init() {
        await this.deps.waitForCore();

        this.setupEventListeners();

        this.initialized = true;
    }

    /**
     * Set up all modal event listeners
     */
    setupEventListeners() {
        // ✅ FIX: Idempotency guard to prevent duplicate listeners
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        this.setupFeedbackModal();
        this.setupAboutModal();
        this.setupSettingsModalClickOutside();
        this.setupRemindersModalHandlers();
        this.setupGlobalKeyHandlers();

    }

    /**
     * Close all modals and overlays in the app
     */
    closeAllModals() {
        // Close all registry-managed modals
        for (const name of MODAL_NAMES) {
            const def = MODAL_DEFS[name];
            // Skip persistent UI elements (e.g., help window) — not closeable via close-all
            if (def.persistent) continue;

            const modal = _deps.getModal(name);
            if (!modal) continue;

            // Native <dialog> elements use animated close; restore focus from the dialog that was open
            if (typeof modal.showModal === 'function') {
                if (modal.open) {
                    animateDialogClose(modal);
                    modal._previousFocus?.focus({ focusVisible: false });
                }
            } else {
                // Non-dialog elements: use legacy close methods
                if (def.closeMethod === 'removeVisible') modal.classList.remove(DOM_CLASSES.VISIBLE);
                else if (def.closeMethod === 'addHidden') modal.classList.add(DOM_CLASSES.HIDDEN);
                else modal.style.display = 'none';
            }
        }

        // Close ephemeral dialog overlays (not in registry — created/destroyed per use)
        document.querySelectorAll('dialog.mini-modal-dialog[open]').forEach(el => el.close());
        document.querySelectorAll('dialog.miniCycle-prompt-dialog[open]').forEach(el => el.close());
        document.querySelectorAll(DOM_SELECTORS.ONBOARDING_MODAL).forEach(el => el.style.display = 'none');

        // Close task options
        document.querySelectorAll(DOM_SELECTORS.TASK_OPTIONS).forEach(action => {
            action.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
        });

        // Reset task states
        document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
            task.classList.remove(DOM_CLASSES.LONG_PRESSED, DOM_CLASSES.DRAGGABLE, DOM_CLASSES.DRAGGING, DOM_CLASSES.SELECTED);
        });

        // Clear any active selections in recurring panels
        document.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM_SELECTED).forEach(item => {
            item.classList.remove(DOM_CLASSES.SELECTED);
        });

        // Hide recurring settings panel if open
        const recurringSettingsPanel = document.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
        if (recurringSettingsPanel) {
            recurringSettingsPanel.classList.add(DOM_CLASSES.HIDDEN);
        }
    }

    /**
     * Set up feedback modal
     */
    setupFeedbackModal() {
        const feedbackModal = _deps.getModal('feedback');
        const openFeedbackBtn = document.getElementById(DOM_IDS.OPEN_FEEDBACK_MODAL);
        const closeFeedbackBtn = document.querySelector(DOM_SELECTORS.CLOSE_FEEDBACK_MODAL);
        const feedbackForm = document.getElementById(DOM_IDS.FEEDBACK_FORM);
        const feedbackText = document.getElementById(DOM_IDS.FEEDBACK_TEXT);
        const submitButton = document.getElementById(DOM_IDS.SUBMIT_FEEDBACK);
        const thankYouMessage = document.getElementById(DOM_IDS.THANK_YOU_MESSAGE);

        if (!feedbackModal || !openFeedbackBtn || !closeFeedbackBtn) {
            console.warn('⚠️ Feedback modal elements not found');
            return;
        }

        // Populate labels from label system (replacing hardcoded HTML strings)
        const titleEl = feedbackModal.querySelector(`#${DOM_IDS.FEEDBACK_MODAL_TITLE}`);
        const descEl = feedbackModal.querySelector(`#${DOM_IDS.FEEDBACK_MODAL_TITLE} + p`);
        const textareaLabel = feedbackModal.querySelector('label[for="feedback-text"]');
        const emailLabel = feedbackModal.querySelector('label[for="feedback-email"]');
        const emailInput = document.getElementById(DOM_IDS.FEEDBACK_EMAIL);

        if (titleEl) titleEl.textContent = getLabel('feedback.title');
        if (descEl) descEl.textContent = getLabel('feedback.description');
        if (closeFeedbackBtn) closeFeedbackBtn.setAttribute('aria-label', getLabel('feedback.closeAria'));
        if (feedbackText) feedbackText.placeholder = getLabel('feedback.placeholder');
        if (textareaLabel) textareaLabel.textContent = getLabel('feedback.feedbackLabel');
        if (emailLabel) emailLabel.textContent = getLabel('feedback.emailLabel');
        if (emailInput) emailInput.placeholder = getLabel('feedback.email');
        if (submitButton) submitButton.textContent = getLabel('feedback.submit');
        if (thankYouMessage) thankYouMessage.textContent = '\u2705 ' + getLabel('feedback.thanks');

        // Use safeAddEventListener to prevent duplicate listeners
        const safeAdd = _deps.safeAddEventListener;

        // Open Modal
        openFeedbackBtn._clickHandler = () => {
            feedbackModal._previousFocus = document.activeElement;
            if (!feedbackModal.open) feedbackModal.showModal();
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
            feedbackModal.close();
            feedbackModal._previousFocus?.focus({ focusVisible: false });
        };
        safeAdd(closeFeedbackBtn, "click", closeFeedbackBtn._clickHandler);

        // Close Modal on Outside Click (backdrop click fires on the dialog element)
        feedbackModal._outsideClickHandler = (event) => {
            if (event.target === feedbackModal && !isClickOnNotification(event)) {
                feedbackModal.close();
                feedbackModal._previousFocus?.focus({ focusVisible: false });
            }
        };
        safeAdd(feedbackModal, "click", feedbackModal._outsideClickHandler);

        // Restore focus when dialog closes (including native ESC)
        safeAdd(feedbackModal, "close", () => {
            feedbackModal._previousFocus?.focus({ focusVisible: false });
        });

        // Handle Form Submission via AJAX (Prevent Page Refresh)
        if (feedbackForm) {
            feedbackForm._submitHandler = (event) => {
                event.preventDefault(); // Prevent default form submission

                // Manual validation (novalidate on form prevents browser flicker).
                // A star rating (hidden input filled by uxRatings.js) makes the
                // message optional — star-only submissions are allowed.
                const hasRating = !!document.getElementById(DOM_IDS.FEEDBACK_RATING_VALUE)?.value;
                if (feedbackText && feedbackText.value.trim().length < 10 && !hasRating) {
                    this.deps.showNotification("⚠️ " + getLabel('feedback.minLengthOrRate'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
                    feedbackText.focus();
                    return;
                }

                // Disable button while sending
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = getLabel('feedback.sending');
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
                            feedbackModal.close();
                            feedbackModal._previousFocus?.focus({ focusVisible: false });
                        }, 2000);
                    } else {
                        this.deps.showNotification("❌ " + getLabel('feedback.errorSend'), "error");
                    }
                })
                .catch(error => {
                    this.deps.showNotification("❌ " + getLabel('feedback.errorNetwork'), "error");
                })
                .finally(() => {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = getLabel('feedback.submit');
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
        const openFeedbackFooter = document.getElementById(DOM_IDS.OPEN_FEEDBACK_MODAL_FOOTER);
        const feedbackModal = _deps.getModal('feedback');
        const thankYouMessage = document.getElementById(DOM_IDS.THANK_YOU_MESSAGE);

        if (openFeedbackFooter && feedbackModal) {
            const safeAdd = _deps.safeAddEventListener;
            openFeedbackFooter._clickHandler = () => {
                feedbackModal._previousFocus = document.activeElement;
                if (!feedbackModal.open) feedbackModal.showModal();
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
        const aboutModal = _deps.getModal('about');
        const openAboutBtn = document.getElementById(DOM_IDS.OPEN_ABOUT_MODAL);

        if (!aboutModal || !openAboutBtn) {
            console.warn('⚠️ About modal elements not found');
            return;
        }

        const safeAdd = _deps.safeAddEventListener;
        const closeAboutBtn = aboutModal.querySelector(DOM_SELECTORS.CLOSE_MODAL);

        // Open Modal
        openAboutBtn._clickHandler = () => {
            aboutModal._previousFocus = document.activeElement;

            // Show the ACTUAL running build (the HTML's baked meta app-version),
            // NOT globalThis.APP_VERSION. version.js is served network-first on a
            // version mismatch, so APP_VERSION can read NEWER than the stale HTML
            // actually rendered. The meta tag is the honest "what am I running".
            const aboutSpan = document.getElementById(DOM_IDS.ABOUT_VERSION);
            if (aboutSpan) {
                const metaEl = document.querySelector('meta[name="app-version"]');
                const buildVersion = (typeof window.getBuildVersion === 'function')
                    ? window.getBuildVersion()
                    : ((metaEl && metaEl.getAttribute('content')) || globalThis.APP_VERSION || 'unknown');
                aboutSpan.textContent = buildVersion;
            }

            // Re-query SW for latest cache version
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (!reg?.active) return;
                    const ch = new globalThis.MessageChannel();
                    ch.port1.onmessage = (evt) => {
                        const swSpan = document.getElementById(DOM_IDS.ABOUT_SW_VERSION);
                        if (swSpan && evt.data) {
                            swSpan.textContent = evt.data.version || 'Unknown';
                        }
                    };
                    try { reg.active.postMessage({ type: 'GET_VERSION' }, [ch.port2]); } catch (_e) { /* SW comm error */ }
                }).catch(() => {});
            }

            if (!aboutModal.open) aboutModal.showModal();
        };
        safeAdd(openAboutBtn, "click", openAboutBtn._clickHandler);

        // Close Modal
        if (closeAboutBtn) {
            closeAboutBtn._clickHandler = () => {
                aboutModal.close();
                aboutModal._previousFocus?.focus({ focusVisible: false });
            };
            safeAdd(closeAboutBtn, "click", closeAboutBtn._clickHandler);
            // Keyboard activation for role="button" span (Enter/Space)
            closeAboutBtn._keydownHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closeAboutBtn.click();
                }
            };
            safeAdd(closeAboutBtn, "keydown", closeAboutBtn._keydownHandler);
        }

        // Close Modal on Outside Click (backdrop click fires on the dialog element)
        aboutModal._outsideClickHandler = (event) => {
            if (event.target === aboutModal && !isClickOnNotification(event)) {
                aboutModal.close();
                aboutModal._previousFocus?.focus({ focusVisible: false });
            }
        };
        safeAdd(aboutModal, "click", aboutModal._outsideClickHandler);

        // Restore focus when dialog closes (including native ESC)
        safeAdd(aboutModal, "close", () => {
            aboutModal._previousFocus?.focus({ focusVisible: false });
        });
    }

    /**
     * Set up settings modal click-outside behavior
     * Note: Main settings modal setup is in setupSettingsMenu()
     * This only handles the click-outside-to-close logic
     */
    setupSettingsModalClickOutside() {
        const settingsModal = _deps.getModal('settings');
        const settingsModalContent = document.querySelector(DOM_SELECTORS.SETTINGS_MODAL_CONTENT);
        const openSettingsBtn = document.getElementById(DOM_IDS.OPEN_SETTINGS);

        if (!settingsModal || !settingsModalContent || !openSettingsBtn) {
            console.warn('⚠️ Settings modal elements not found');
            return;
        }

        // This is handled in setupSettingsMenu, but we track it here for closeAllModals
    }

    /**
     * Compatibility wrapper for reminders modal wiring.
     * reminders.js owns the modal, but we reuse the same element-level keys so
     * either setup path replaces the previous handler instead of stacking it.
     */
    setupRemindersModalHandlers() {
        const remindersModal = _deps.getModal('reminders');
        const closeRemindersBtn = document.getElementById(DOM_IDS.CLOSE_REMINDERS_BTN);

        if (!remindersModal) {
            console.warn('⚠️ Reminders modal not found');
            return;
        }

        if (closeRemindersBtn) {
            replaceStoredEventListener(
                closeRemindersBtn,
                "click",
                "__miniCycleRemindersCloseClickHandler",
                () => {
                    if (remindersModal.open) {
                        remindersModal.close();
                    }
                }
            );
        }

        replaceStoredEventListener(
            remindersModal,
            "click",
            "__miniCycleRemindersModalClickHandler",
            (event) => {
                if (event.target === remindersModal && remindersModal.open && !isClickOnNotification(event)) {
                    remindersModal.close();
                }
            }
        );

        replaceStoredEventListener(
            remindersModal,
            "close",
            "__miniCycleRemindersModalCloseHandler",
            () => {
                remindersModal._previousFocus?.focus({ focusVisible: false });
            }
        );
    }

    /**
     * Set up global keyboard handlers (ESC key)
     */
    setupGlobalKeyHandlers() {
        if (this.deps.safeAddEventListener) {
            replaceStoredEventListener(document, "keydown", "__miniCycleModalManagerGlobalKeyHandler", (e) => {
                if (e.key === "Escape") {
                    const hasOpenModal = this.isModalOpen();
                    const notifications = document.querySelectorAll(DOM_SELECTORS.NOTIFICATION);
                    const hasNotification = notifications.length > 0;

                    // Only act if there's something to close
                    if (!hasOpenModal && !hasNotification) return;

                    // When notifications are visible alongside a modal, dismiss notifications
                    // first and keep the modal open. This prevents ESC from closing e.g. the
                    // preferences dialog while a tour prompt notification is showing.
                    if (hasNotification && hasOpenModal) {
                        e.preventDefault(); // Block native <dialog> ESC close
                        notifications.forEach(notification => {
                            if (notification.querySelector(DOM_SELECTORS.CLOSE_BTN)) {
                                notification.querySelector(DOM_SELECTORS.CLOSE_BTN).click();
                            }
                        });
                        return;
                    }

                    // Native <dialog> elements handle their own ESC (close event fires automatically).
                    // This handler covers non-dialog cleanup: task options, recurring panels, notifications, etc.
                    if (hasOpenModal) {
                        this.closeAllModals();
                    }

                    // Dismiss notifications (no modal open)
                    if (hasNotification) {
                        notifications.forEach(notification => {
                            if (notification.querySelector(DOM_SELECTORS.CLOSE_BTN)) {
                                notification.querySelector(DOM_SELECTORS.CLOSE_BTN).click();
                            }
                        });
                    }
                }
            });

        } else {
            console.warn('⚠️ safeAddEventListener not available for global key handlers');
        }
    }

    /**
     * Check if any modal is currently open
     * @returns {boolean} True if any modal is open
     */
    isModalOpen() {
        // Check all registry-managed modals
        for (const name of MODAL_NAMES) {
            const modal = _deps.getModal(name);
            if (!modal) continue;

            // Native <dialog> elements expose the .open property
            if (typeof modal.showModal === 'function') {
                if (modal.open) return true;
            } else {
                // Non-dialog elements: use legacy checks
                const def = MODAL_DEFS[name];
                if (def.closeMethod === 'removeVisible' && modal.classList.contains(DOM_CLASSES.VISIBLE)) return true;
                if (def.closeMethod === 'addHidden' && !modal.classList.contains(DOM_CLASSES.HIDDEN)) return true;
                if (modal.style.display === 'flex' || modal.style.display === 'block') return true;
            }
        }

        // Check ephemeral dialog overlays (not in registry)
        if (document.querySelector('dialog.mini-modal-dialog[open]')) return true;
        if (document.querySelector('dialog.miniCycle-prompt-dialog[open]')) return true;
        if (document.querySelector('.onboarding-modal:not([style*="display: none"])')) return true;

        return false;
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

// Named exports only (no default export)
// Note: ModalManager class is already exported at declaration
export { modalManager };
