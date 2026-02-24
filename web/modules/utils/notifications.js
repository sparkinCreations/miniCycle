/**
 * MiniCycle Notifications Module (Schema 2.5)
 *
 * Comprehensive notification system with toast messages,
 * educational tips, and modal dialogs.
 *
 * Features:
 * - Toast notifications (info, success, warning, error)
 * - Drag-enabled position persistence
 * - Educational tips with dismissal tracking
 * - Recurring task notifications
 * - Modal dialogs (confirmation & prompt)
 * - Schema 2.5 data integration
 *
 * @module utils/notifications
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {'info'|'success'|'warning'|'error'|'show'} NotificationType
 */

/**
 * @typedef {Object} NotificationOptions
 * @property {string} message - Message to display
 * @property {NotificationType} [type='info'] - Notification type
 * @property {number} [duration=3000] - Display duration in ms
 * @property {string} [tip] - Optional educational tip
 * @property {string} [tipId] - Tip ID for dismissal tracking
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, Z_INDEX } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================
// NOTE: No appContext fallback - all dependencies must come through DI
// This avoids versioned/unversioned module instance mismatch issues

const di = createDIModule('Notifications', {
  appInit: optional(null),  // AppInit for initialization coordination
  AppState: optional(null),
  loadMiniCycleData: optional(null),
  generateHashId: optional(null),
  GlobalUtils: optional(null),
  escapeHtml: optional(null),
  applyRecurringToTaskSchema25: optional(null),
  updateRecurringPanel: optional(null),
  openRecurringSettingsPanelForTask: optional(null),
  safeAddEventListener: optional(null),
  vocabThemeManager: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, loadMiniCycleData: Function|null, generateHashId: Function|null, GlobalUtils: Object|null, escapeHtml: Function|null, applyRecurringToTaskSchema25: Function|null, updateRecurringPanel: Function|null, openRecurringSettingsPanelForTask: Function|null, safeAddEventListener: Function|null}} */
const _deps = new Proxy({}, {
  get(_, prop) {
    return di.resolve()[prop];
  }
});

/**
 * Safe event listener helper - uses DI safeAddEventListener or falls back to native
 * This ensures the module works even if safeAddEventListener isn't injected
 */
function _safeAddEventListener(element, event, handler, options) {
  const safeAdd = _deps.safeAddEventListener;
  if (typeof safeAdd === 'function') {
    safeAdd(element, event, handler, options);
  } else if (element && typeof element.addEventListener === 'function') {
    element.addEventListener(event, handler, options);
  }
}

/**
 * Simple hash function for generating stable IDs from strings
 * Used as fallback when generateHashId is not injected via DI
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Set dependencies for Notifications module (call before creating instance)
 * @param {Object} dependencies - Late-injected dependencies
 */
export function setNotificationsDependencies(dependencies) {
  di.setDependencies(dependencies);
  console.log('🔔 Notifications dependencies set:', Object.keys(dependencies));
}

/**
 * 🎓 Educational Tips Manager Class
 */
class EducationalTipManager {
  constructor(getDeps) {
    // Store getter function for live deps access
    this._getDeps = typeof getDeps === 'function' ? getDeps : () => getDeps;
    this.dismissedTips = null; // Will be loaded lazily
  }

  // Getter that always returns current deps
  get deps() {
    return this._getDeps();
  }

  loadDismissedTips() {
    console.log('📚 Loading dismissed tips (Schema 2.5 only)...');

    try {
      // Check if loadMiniCycleData is available (DI-pure)
      if (typeof this.deps.loadMiniCycleData !== 'function') {
        console.warn('⚠️ loadMiniCycleData not yet available, using fallback');
        return {};
      }

      const schemaData = this.deps.loadMiniCycleData();
      if (!schemaData || !schemaData.settings) {
        console.error('❌ Schema 2.5 data required for loadDismissedTips');
        return {};
      }

      // ✅ DI-pure: Use schemaData directly, no localStorage access
      return schemaData.settings.dismissedEducationalTips || {};
    } catch (e) {
      console.warn('⚠️ Error loading dismissed tips from Schema 2.5:', e);
      return {};
    }
  }

  getDismissedTips() {
    if (this.dismissedTips === null) {
      this.dismissedTips = this.loadDismissedTips();
    }
    return this.dismissedTips;
  }

  async saveDismissedTips() {
    console.log('💾 Saving dismissed tips (Schema 2.5 only)...');

    try {
      // ✅ DEFENSIVE CHECK: Ensure deps and AppState exist before accessing
      // Node.js 20.x timing differences can cause AppState to be undefined
      const deps = this.deps;
      if (!deps || !deps.AppState) {
        console.warn('⚠️ AppState not available for saveDismissedTips (deps not ready)');
        return;
      }

      // ✅ Use AppState only (DI-pure, no localStorage fallback)
      if (typeof deps.AppState.isReady !== 'function' || !deps.AppState.isReady()) {
        console.warn('⚠️ AppState not ready for saveDismissedTips');
        return;
      }

      await deps.AppState.update(state => {
        if (!state.settings) state.settings = {};
        state.settings.dismissedEducationalTips = this.getDismissedTips();
      }, true);

      console.log('✅ Dismissed tips saved to Schema 2.5');
    } catch (e) {
      console.error('❌ Error saving dismissed tips to Schema 2.5:', e);
    }
  }

  isTipDismissed(tipId) {
    return this.getDismissedTips()[tipId] === true;
  }

  dismissTip(tipId) {
    console.log('🚫 Dismissing tip (Schema 2.5):', tipId);
    this.getDismissedTips()[tipId] = true;
    this.saveDismissedTips();
  }

  showTip(tipId) {
    console.log('👁️ Showing tip (Schema 2.5):', tipId);
    delete this.getDismissedTips()[tipId];
    this.saveDismissedTips();
  }

  createTip(tipId, tipText, options = {}) {
    const {
      icon = '💡',
      borderColor = 'rgba(255, 255, 255, 0.3)',
      backgroundColor = 'rgba(255, 255, 255, 0.1)',
      className = 'educational-tip'
    } = options;

    const isDismissed = this.isTipDismissed(tipId);
    
    return `
      <div class="${className}" id="tip-${tipId}" data-tip-id="${tipId}" 
           style="display: ${isDismissed ? 'none' : 'block'};">
        <div class="tip-content">
          <span class="tip-icon">${icon}</span>
          <span class="tip-text">${tipText}</span>
          <button class="tip-close" aria-label="${getLabel('notify.dismissTip')}">✕</button>
        </div>
      </div>
      <button class="tip-toggle ${isDismissed ? 'show' : 'hide'}"
              data-tip-id="${tipId}"
              aria-label="${getLabel('notify.showTip')}">
        💡
      </button>
    `;
  }

  initTipListeners(container) {
    // Create bound handlers for this container (stored on container to enable removal)
    if (!container._tipCloseHandler) {
      container._tipCloseHandler = (e) => {
        if (e.target.classList.contains('tip-close')) {
          e.stopPropagation();
          const tipElement = e.target.closest('.educational-tip');
          const tipId = tipElement.dataset.tipId;
          this.hideTip(tipId, container);
        }
      };
    }

    if (!container._tipToggleHandler) {
      container._tipToggleHandler = (e) => {
        if (e.target.classList.contains('tip-toggle') || e.target.classList.contains('tip-toggle-btn')) {
          e.stopPropagation();
          const tipId = e.target.dataset.tipId;
          const tipElement = container.querySelector(`#tip-${tipId}`);

          if (tipElement.style.display === 'none') {
            this.showTipElement(tipId, container);
          } else {
            this.hideTip(tipId, container);
          }
        }
      };
    }

    // Handle tip close buttons
    _safeAddEventListener(container, 'click', container._tipCloseHandler);

    // Handle tip toggle buttons
    _safeAddEventListener(container, 'click', container._tipToggleHandler);
  }

  hideTip(tipId, container) {
    const tipElement = container.querySelector(`#tip-${tipId}`);
    const toggleButton = container.querySelector(`.tip-toggle[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        tipElement.style.display = 'none';
        if (toggleButton) {
          toggleButton.classList.remove('hide');
          toggleButton.classList.add('show');
        }
      }, 200);
    }
    
    this.dismissTip(tipId);
  }

  showTipElement(tipId, container) {
    const tipElement = container.querySelector(`#tip-${tipId}`);
    const toggleButton = container.querySelector(`.tip-toggle[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.display = 'block';
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      // Force reflow
      tipElement.offsetHeight;
      
      tipElement.style.opacity = '1';
      tipElement.style.transform = 'translateY(0)';
      
      if (toggleButton) {
        toggleButton.classList.remove('show');
        toggleButton.classList.add('hide');
      }
    }
    
    this.showTip(tipId);
  }
}

/**
 * 🔒 Get escape function from deps (helper for XSS protection)
 * @param {Object} deps - Dependencies object
 * @returns {Function} Escape function
 */
function getEscapeHtml(deps) {
  return deps.GlobalUtils?.escapeHtml
    || deps.escapeHtml
    || ((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;'));
}

/**
 * 🔔 Main MiniCycle Notifications Class
 */
// Store instance reference for late dep updates
let _notificationsInstance = null;

export class MiniCycleNotifications {
  constructor(dependencies = {}) {
    // Store constructor-provided deps separately
    this._constructorDeps = dependencies;

    // Pass getter function to EducationalTipManager for live deps access
    this.educationalTips = new EducationalTipManager(() => this.deps);
    this.isDraggingNotification = false;
    this._activeListeners = new WeakMap(); // ✅ FIX #2: Track cleanup functions per notification

    // Store instance reference for late dep updates
    _notificationsInstance = this;
  }

  // Getter that always returns merged deps (live reference to DI-resolved deps)
  // NOTE: Can't spread _deps proxy - must call di.resolve() directly
  get deps() {
    return { ...di.resolve(), ...this._constructorDeps };
  }

  // Helper method to update dragging state (no window.* sync needed)
  setDraggingState(isDragging) {
    this.isDraggingNotification = isDragging;
  }

  /**
   * Ensure notification container is in the browser's top layer above any open
   * <dialog> modals. Native showModal() places dialogs in the top layer, which
   * renders above all normal DOM z-index values. Using popover="manual" puts
   * the container in the same top layer, and re-showing it moves it on top.
   * @param {HTMLElement} container - The notification container element
   */
  _ensureAboveDialogs(container) {
    if (!container?.hasAttribute('popover')) return;
    try {
      if (container.matches(':popover-open')) container.hidePopover();
      container.showPopover();
    } catch (e) {
      // Popover API not supported — falls back to normal z-index stacking
    }
  }

  /**
   * 🎯 Core notification display function
   */
  show(message, type = "default", duration = null, options = {}) {
    try {
      // Check user preference — errors always show; all others suppressed when disabled
      if (type !== 'error') {
        const AppState = _deps.AppState;
        if (AppState?.isReady?.()) {
          const notificationsEnabled = AppState.get()?.settings?.notificationsEnabled ?? true;
          if (!notificationsEnabled) return;
        }
      }

      const notificationContainer = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
      if (!notificationContainer) {
        console.warn("⚠️ Notification container not found.");
        return;
      }

      this._ensureAboveDialogs(notificationContainer);

      if (typeof message !== "string" || message.trim() === "") {
        console.warn("⚠️ Invalid or empty message passed to show().");
        message = "⚠️ " + getLabel('notify.unknownNotification');
      }

      // Generate unique ID (DI-pure) - use simple hash fallback for duplicate detection
      const newId = _deps.generateHashId?.(message) || `notif-${simpleHash(message)}`;
      if ([...notificationContainer.querySelectorAll(DOM_SELECTORS.NOTIFICATION)]
          .some(n => n.dataset.id === newId)) {
        console.log("🔄 Notification already exists, skipping duplicate.");
        return;
      }

      const notification = document.createElement("div");
      notification.classList.add("notification", "show");
      notification.dataset.id = newId;

      if (["error", "success", "info", "warning", "recurring"].includes(type)) {
        notification.classList.add(type);
      }

      // Accessibility: role="alert" for urgent types, role="status" for others
      notification.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');

      // ✅ XSS PROTECTION: Always escape HTML in message content (DI-pure)
      // Security fix (v1.353): Remove bypass condition to prevent XSS
      const escapedMessage = this.deps.GlobalUtils?.escapeHtml
        ? this.deps.GlobalUtils.escapeHtml(message)
        : (typeof this.deps.escapeHtml === 'function' ? this.deps.escapeHtml(message) : message);

      // Always escape user content, regardless of structure
      // When an action button is present, wrap message in a span so both sit in a flex-column
      const hasAction = !!(options?.actionButton);
      notification.innerHTML = hasAction
        ? `<div class="notification-content notification-has-action">
             <span class="notification-message">${escapedMessage}</span>
           </div>
           <button class="close-btn" title="${getLabel('button.close')}" aria-label="${getLabel('notify.closeNotification')}">✖</button>`
        : `<div class="notification-content">${escapedMessage}</div>
           <button class="close-btn" title="${getLabel('button.close')}" aria-label="${getLabel('notify.closeNotification')}">✖</button>`;

      // ✅ FIX #7: Track cleanup function for timeouts
      let cleanupTimeouts = null;

      // Style and handler for any close button
      const closeBtn = notification.querySelector(DOM_SELECTORS.CLOSE_BTN);
      if (closeBtn) {
        Object.assign(closeBtn.style, {
          position: "absolute",
          top: "6px",
          right: "6px",
          background: "transparent",
          border: "none",
          fontSize: "16px",
          cursor: "pointer",
          color: "#fff",
          lineHeight: "1",
          padding: "0"
        });

        // Store handler on element for safeAddEventListener
        closeBtn._clickHandler = (e) => {
          e.stopPropagation();

          // FIX #7: Clean up any active timeouts before removing
          if (cleanupTimeouts) cleanupTimeouts();

          notification.classList.remove("show");
          setTimeout(() => notification.remove(), UI_TIMEOUTS.NOTIFICATION_FADE);
        };
        _safeAddEventListener(closeBtn, "click", closeBtn._clickHandler);
      }

      // Optional action button — appended as second flex child inside notification-has-action
      if (hasAction) {
        const { label: btnLabel, onClick } = options.actionButton;
        const contentDiv = notification.querySelector('.notification-content');
        if (contentDiv && typeof btnLabel === 'string') {
          const actionBtn = document.createElement('button');
          actionBtn.className = 'notification-action-btn';
          actionBtn.textContent = btnLabel; // textContent for XSS safety
          actionBtn._clickHandler = (e) => {
            e.stopPropagation();
            if (cleanupTimeouts) cleanupTimeouts();
            notification.classList.remove('show');
            setTimeout(() => {
              notification.remove();
              if (typeof onClick === 'function') onClick();
            }, UI_TIMEOUTS.NOTIFICATION_FADE);
          };
          _safeAddEventListener(actionBtn, 'click', actionBtn._clickHandler);
          contentDiv.appendChild(actionBtn);
        }
      }

      notificationContainer.appendChild(notification);

      // Restore saved position from Schema 2.5
      this.restoreNotificationPosition(notificationContainer);

      // Auto-remove after duration (hover pause)
      console.log(`🔍 Notification debug - Type: "${type}", Duration: ${duration} (type: ${typeof duration}), Will auto-dismiss: ${!!duration}, Truthy check: ${Boolean(duration)}`);
      if (duration) {
        console.log(`⏱️ Setting up auto-remove with duration: ${duration}ms`);
        cleanupTimeouts = this.setupAutoRemove(notification, duration);
      } else {
        console.log(`♾️ No duration set - notification requires manual dismissal (received: ${duration})`);
      }

      // Setup drag support
      this.setupNotificationDragging(notificationContainer);

      return notification;

    } catch (err) {
      console.error("❌ Notification show failed:", err);
    }
  }

  /**
   * 🔧 Enhanced notification with educational tips support
   *
   * ⚠️ SECURITY: By default, content is HTML-escaped to prevent XSS.
   * Pass { trusted: true } as the 5th argument ONLY for pre-built HTML
   * where all user content has already been escaped.
   *
   * @param {string} content - Notification content (escaped by default)
   * @param {string} type - Notification type (default, error, success, etc.)
   * @param {number|null} duration - Auto-dismiss duration in ms
   * @param {string|null} tipId - Educational tip ID
   * @param {Object} options - Options object
   * @param {boolean} options.trusted - If true, content is treated as trusted HTML (DANGEROUS)
   */
  showWithTip(content, type = "default", duration = null, tipId = null, options = {}) {
    try {
      // Same mute check as show() — errors always get through
      if (type !== 'error') {
        const AppState = _deps.AppState;
        if (AppState?.isReady?.()) {
          const notificationsEnabled = AppState.get()?.settings?.notificationsEnabled ?? true;
          if (!notificationsEnabled) return;
        }
      }

      const notificationContainer = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
      if (!notificationContainer) {
        console.warn("⚠️ Notification container not found.");
        return;
      }

      this._ensureAboveDialogs(notificationContainer);

      if (typeof content !== "string" || content.trim() === "") {
        console.warn("⚠️ Invalid or empty message passed to showWithTip().");
        content = "⚠️ " + getLabel('notify.unknownNotification');
      }

      // ✅ XSS PROTECTION: Escape content by default unless explicitly trusted
      const escape = getEscapeHtml(this.deps);
      const safeContent = options.trusted === true ? content : escape(content);

      const newId = _deps.generateHashId?.(content) || `notif-${simpleHash(content)}`;
      const existing = [...notificationContainer.querySelectorAll(DOM_SELECTORS.NOTIFICATION)];

      // Prevent duplicates
      if (existing.some(n => n.dataset.id === newId)) {
        console.log("🔄 Notification already exists, skipping duplicate.");
        return;
      }

      // Build notification
      const notification = document.createElement("div");
      notification.classList.add("notification", "show");
      notification.dataset.id = newId;

      if (type === "error") notification.classList.add("error");
      if (type === "success") notification.classList.add("success");
      if (type === "info") notification.classList.add("info");
      if (type === "warning") notification.classList.add("warning");
      if (type === "recurring") notification.classList.add("recurring");

      // Accessibility: role="alert" for urgent types, role="status" for others
      notification.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');

      // Check if HTML already has a close button before adding one (only for trusted content)
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = safeContent;
      const hasCloseBtn = options.trusted && tempDiv.querySelector(DOM_SELECTORS.CLOSE_BTN + ", " + DOM_SELECTORS.NOTIFICATION_CLOSE);

      if (hasCloseBtn) {
        notification.innerHTML = safeContent;
      } else {
        notification.innerHTML = `
          <div class="notification-content">${safeContent}</div>
          <button class="notification-close" aria-label="${getLabel('notify.closeNotification')}">✖</button>
        `;
      }

      notificationContainer.appendChild(notification);

      // ✅ FIX #7: Track cleanup function for timeouts
      let cleanupTimeouts = null;

      // Close button click
      const closeBtn = notification.querySelector(DOM_SELECTORS.CLOSE_BTN + ", " + DOM_SELECTORS.NOTIFICATION_CLOSE);
      if (closeBtn) {
        closeBtn._clickHandler = (e) => {
          e.stopPropagation();

          // FIX #7: Clean up any active timeouts before removing
          if (cleanupTimeouts) cleanupTimeouts();

          notification.classList.remove("show");
          setTimeout(() => notification.remove(), UI_TIMEOUTS.NOTIFICATION_FADE);
        };
        _safeAddEventListener(closeBtn, "click", closeBtn._clickHandler);
      }

      // Initialize tip listeners if this notification has tips
      if (tipId || notification.querySelector(DOM_SELECTORS.EDUCATIONAL_TIP)) {
        this.educationalTips.initTipListeners(notification);
      }

      // Restore saved position from Schema 2.5
      this.restoreNotificationPosition(notificationContainer);

      // Auto-remove logic with hover pause
      if (duration) {
        cleanupTimeouts = this.setupAutoRemove(notification, duration);
      }

      // Dragging setup
      this.setupNotificationDragging(notificationContainer);

      return notification;

    } catch (err) {
      console.error("❌ showWithTip failed:", err);
    }
  }

  /**
   * 🔄 Reset notification position
   */
  async resetPosition() {
    console.log("🔄 Resetting notification position (Schema 2.5 only)...");

    // Apply the calculated default position (top-right, below logo)
    // setDefaultPosition handles waitForCore + saves position with modified=false
    const container = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
    if (container) {
      await this.setDefaultPosition(container);
    } else {
      console.warn('⚠️ Notification container not found for resetPosition');
    }

    console.log("✅ Notification position reset completed (Schema 2.5)");
  }

  /**
   * 🎯 Restore notification position from Schema 2.5
   */
restoreNotificationPosition(notificationContainer) {
    try {
        // ✅ Check if loadMiniCycleData is available (DI-pure)
        if (typeof this.deps.loadMiniCycleData !== 'function') {
            console.log('⏳ loadMiniCycleData not yet available, using default position');
            this.setDefaultPosition(notificationContainer);
            return;
        }

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.log('📋 No schema data available, using default position');
            this.setDefaultPosition(notificationContainer);
            return;
        }

        const savedPosition = schemaData.settings?.notificationPosition;
        const positionModified = schemaData.settings?.notificationPositionModified;

        // ✅ Only use saved position if user has actually modified it
        // Initial state has {x:0, y:0} with modified=false, which should use calculated default
        if (
            positionModified === true &&
            savedPosition &&
            typeof savedPosition.x === 'number' &&
            typeof savedPosition.y === 'number'
        ) {
            notificationContainer.style.top = `${savedPosition.y}px`;
            notificationContainer.style.left = `${savedPosition.x}px`;
            notificationContainer.style.right = "auto";
        } else {
            // No user-modified position - set a smart default
            this.setDefaultPosition(notificationContainer);
        }
    } catch (posError) {
        console.warn("⚠️ Failed to apply saved notification position.", posError);
        this.setDefaultPosition(notificationContainer);
    }
}


/**
 * 📍 Set smart default notification position
 */
async setDefaultPosition(notificationContainer) {
    // Get viewport width for responsive positioning
    const viewportWidth = window.innerWidth;

    // Smart positioning: top-right, below logo
    let defaultX, defaultY;
    const notificationWidth = 320; // Approximate notification width
    const rightMargin = 20; // Gap from right edge

    if (viewportWidth <= 768) {
        // Mobile: Right side, below logo area
        defaultX = Math.max(20, viewportWidth - notificationWidth - rightMargin);
        defaultY = 70; // Below logo
    } else {
        // Desktop: Right side, below logo area
        defaultX = viewportWidth - notificationWidth - rightMargin;
        defaultY = 70; // Below logo
    }

    // Apply the position immediately (synchronous)
    notificationContainer.style.top = `${defaultY}px`;
    notificationContainer.style.left = `${defaultX}px`;
    notificationContainer.style.right = "auto";

    // Save this default position to Schema 2.5 so it persists (asynchronous, non-blocking)
    try {
        // ✅ Only save if AppState is available (DI-pure)
        if (!this.deps.AppState || typeof this.deps.AppState.update !== 'function') {
            console.log('⏳ AppState not ready, position not saved (will use default next time)');
            return;
        }

        // ✅ Wait for core systems to be ready (AppState + data)
        await _deps.appInit?.waitForCore();

        this.deps.AppState.update((state) => {
            if (state.settings) {
                state.settings.notificationPosition = { x: defaultX, y: defaultY };
                state.settings.notificationPositionModified = false; // Mark as default
            }
        }, true);
    } catch (error) {
        console.log('⏭️ Could not save default notification position (not critical):', error.message);
    }
}
  /**
   * ⏰ Setup auto-remove with hover pause functionality
   * Returns cleanup function to clear timeouts
   */
  setupAutoRemove(notification, duration) {
    console.log(`🔧 setupAutoRemove called with duration: ${duration} (type: ${typeof duration})`);
    let hoverPaused = false;
    let focusPaused = false;
    let remaining = duration;
    let removeTimeout;
    let removeDelayTimeout; // ✅ FIX #7: Track fade-out delay timeout
    let startTime = Date.now();

    const clearNotification = () => {
      console.log(`🗑️ Auto-removing notification after ${duration}ms`);
      notification.classList.remove("show");
      removeDelayTimeout = setTimeout(() => notification.remove(), UI_TIMEOUTS.NOTIFICATION_FADE);
    };

    const startTimer = () => {
      startTime = Date.now();
      removeTimeout = setTimeout(() => {
        if (!hoverPaused && !focusPaused) clearNotification();
      }, remaining);
    };

    // Only capture remaining time if the timer is actually running (neither source paused)
    const pauseIfRunning = () => {
      if (!hoverPaused && !focusPaused) {
        clearTimeout(removeTimeout);
        remaining -= (Date.now() - startTime);
        if (remaining < 0) remaining = 0;
      }
    };

    // Only restart the timer if both sources are unpaused
    const resumeIfUnpaused = () => {
      if (!hoverPaused && !focusPaused) {
        startTimer();
      }
    };

    startTimer();

    // Mouse hover pause
    _safeAddEventListener(notification, "mouseenter", () => {
      pauseIfRunning();
      hoverPaused = true;
    });
    _safeAddEventListener(notification, "mouseleave", () => {
      hoverPaused = false;
      resumeIfUnpaused();
    });

    // Keyboard focus pause: keep notification alive while user is tabbing through
    _safeAddEventListener(notification, "focusin", () => {
      pauseIfRunning();
      focusPaused = true;
    });
    _safeAddEventListener(notification, "focusout", () => {
      // Delay check: focusout fires before the new element receives focus
      requestAnimationFrame(() => {
        if (!notification.contains(document.activeElement)) {
          focusPaused = false;
          resumeIfUnpaused();
        }
      });
    });

    // ✅ FIX #7: Return cleanup function to clear all timeouts
    return () => {
      if (removeTimeout) clearTimeout(removeTimeout);
      if (removeDelayTimeout) clearTimeout(removeDelayTimeout);
      console.log('🧹 Cleared notification timeouts');
    };
  }

  /**
   * 🖱️ Setup notification dragging functionality
   */
  setupNotificationDragging(notificationContainer) {
    if (notificationContainer.dragListenersAttached) return;
    notificationContainer.dragListenersAttached = true;

    const interactiveSelectors = [
      '.tip-close', '.tip-toggle',
      '.quick-option', '.radio-circle', '.option-label',
      '.apply-quick-recurring', '.open-recurring-settings', '.show-quick-actions',
      'button', 'input', 'select', 'textarea', 'a[href]'
    ];

    // ✅ Throttle helper: limit saves to every 100ms during drag
    let lastSaveTime = 0;
    let pendingSave = null;
    const THROTTLE_MS = 100;

    // Save position to Schema 2.5 via AppState (DI-pure, throttled)
    const savePositionToSchema25 = async (x, y) => {
      const now = Date.now();

      // Throttle: skip if called too recently
      if (now - lastSaveTime < THROTTLE_MS) {
        // Schedule a final save for the last position
        if (pendingSave) clearTimeout(pendingSave);
        pendingSave = setTimeout(() => savePositionToSchema25(x, y), THROTTLE_MS);
        return;
      }

      lastSaveTime = now;
      if (pendingSave) {
        clearTimeout(pendingSave);
        pendingSave = null;
      }

      try {
        // ✅ Check if AppState is available before waiting
        if (!this.deps.AppState?.update) {
          // Silently skip if AppState not ready - not critical
          return;
        }

        // ✅ Wait for core systems to be ready (AppState + data)
        await _deps.appInit?.waitForCore();

        // ✅ AppState.update() expects a function, not an object (DI-pure)
        this.deps.AppState.update((state) => {
          if (!state.settings) {
            console.error('❌ Invalid state structure for notification position');
            return;
          }
          state.settings.notificationPosition = { x, y };
          state.settings.notificationPositionModified = true;
        }, true); // Immediate save to prevent race conditions

        console.log('💾 Notification position saved via AppState:', { x, y });
      } catch (error) {
        console.warn("⚠️ Failed to save notification position:", error);
      }
    };

    // ✅ FIX #2: Track cleanup functions for this notification
    const cleanupFunctions = [];

    // Mouse dragging
    const mouseDownHandler = (e) => {
      const isInteractive = interactiveSelectors.some(selector =>
        e.target.matches(selector) || e.target.closest(selector)
      );
      if (isInteractive) return;

      let dragStarted = false;
      let startX = e.clientX;
      let startY = e.clientY;
      const dragThreshold = 5;

      const rect = notificationContainer.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const startDrag = () => {
        if (!dragStarted) {
          dragStarted = true;
          this.setDraggingState(true);
          notificationContainer.classList.add("dragging");
          document.body.style.userSelect = 'none';
        }
      };

      const onMouseMove = (e) => {
        const moveDistance = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
        if (!dragStarted && moveDistance > dragThreshold) startDrag();
        if (dragStarted) {
          e.preventDefault();
          const newY = e.clientY - offsetY;
          const newX = e.clientX - offsetX;

          notificationContainer.style.top = `${newY}px`;
          notificationContainer.style.left = `${newX}px`;
          notificationContainer.style.right = "auto";

          savePositionToSchema25(newX, newY);
        }
      };

      const onMouseUp = (e) => {
        if (dragStarted) {
          this.setDraggingState(false);
          notificationContainer.classList.remove("dragging");
          document.body.style.userSelect = '';
          if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > dragThreshold) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      _safeAddEventListener(document, "mousemove", onMouseMove);
      _safeAddEventListener(document, "mouseup", onMouseUp);

      // FIX #2: Store cleanup for forced cleanup on notification removal
      cleanupFunctions.push(() => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      });
    };

    _safeAddEventListener(notificationContainer, "mousedown", mouseDownHandler);
    cleanupFunctions.push(() => {
      notificationContainer.removeEventListener("mousedown", mouseDownHandler);
    });

    // Touch dragging
    const touchStartHandler = (e) => {
      const isInteractive = interactiveSelectors.some(selector =>
        e.target.matches(selector) || e.target.closest(selector)
      );
      if (isInteractive) return;

      let dragStarted = false;
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      const dragThreshold = 8;

      const rect = notificationContainer.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;

      const startDrag = () => {
        if (!dragStarted) {
          dragStarted = true;
          this.setDraggingState(true);
          notificationContainer.classList.add("dragging");
          document.body.style.overflow = 'hidden';
        }
      };

      const onTouchMove = (e) => {
        const touch = e.touches[0];
        const moveDistance = Math.abs(touch.clientX - startX) + Math.abs(touch.clientY - startY);
        if (!dragStarted && moveDistance > dragThreshold) startDrag();
        if (dragStarted) {
          e.preventDefault();
          const newY = touch.clientY - offsetY;
          const newX = touch.clientX - offsetX;

          notificationContainer.style.top = `${newY}px`;
          notificationContainer.style.left = `${newX}px`;
          notificationContainer.style.right = "auto";

          savePositionToSchema25(newX, newY);
        }
      };

      const onTouchEnd = (e) => {
        if (dragStarted) {
          this.setDraggingState(false);
          notificationContainer.classList.remove("dragging");
          document.body.style.overflow = '';
          const finalTouch = e.changedTouches[0];
          if (Math.abs(finalTouch.clientX - startX) + Math.abs(finalTouch.clientY - startY) > dragThreshold) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };

      _safeAddEventListener(document, "touchmove", onTouchMove, { passive: false });
      _safeAddEventListener(document, "touchend", onTouchEnd, { passive: false });

      // FIX #2: Store cleanup for forced cleanup on notification removal
      cleanupFunctions.push(() => {
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      });
    };

    _safeAddEventListener(notificationContainer, "touchstart", touchStartHandler, { passive: true });
    cleanupFunctions.push(() => {
      notificationContainer.removeEventListener("touchstart", touchStartHandler);
    });

    // ✅ FIX #2: Watch for notification removal and cleanup listeners
    const cleanup = () => {
      console.log('🧹 Cleaning up notification listeners');
      // Clear any pending throttled save
      if (pendingSave) {
        clearTimeout(pendingSave);
        pendingSave = null;
      }
      cleanupFunctions.forEach(fn => fn());
      this._activeListeners.delete(notificationContainer);
    };

    // Store cleanup function in WeakMap
    this._activeListeners.set(notificationContainer, cleanup);

    // Use MutationObserver to detect when notification is removed
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === notificationContainer || node.contains(notificationContainer)) {
            cleanup();
            observer.disconnect();
            return;
          }
        }
      }
    });

    // Observe the parent for child removal
    if (notificationContainer.parentNode) {
      observer.observe(notificationContainer.parentNode, { childList: true });
      cleanupFunctions.push(() => observer.disconnect());
    }
  }

  /**
   * 🔁 Create recurring notification with educational tip (two-state: collapsed/expanded)
   */
  createRecurringNotificationWithTip(assignedTaskId, frequency, pattern, taskText = '') {
    const tipId = 'recurring-cycle-explanation';
    const tipText = getLabel('notify.recurringTipExplanation');

    const educationalTipHTML = `
      <div class="educational-tip recurring-tip" id="tip-${tipId}" data-tip-id="${tipId}" style="display: none;">
        <div class="tip-content">
          <span class="tip-icon">📍</span>
          <span class="tip-text">${tipText}</span>
          <button class="tip-close" aria-label="${getLabel('notify.dismissTip')}">✕</button>
        </div>
      </div>
    `;

    // ✅ XSS PROTECTION: Use DI-based escape for consistency (DI-pure)
    const escape = this.deps.GlobalUtils?.escapeHtml
      || this.deps.escapeHtml
      || ((s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    const escapedTaskText = escape(taskText);

    return `
      <div class="main-notification-content"
           data-task-id="${assignedTaskId}"
           style="position: relative; display: block; padding: 12px 42px 12px 16px; border-radius: 6px;">

        ${educationalTipHTML}

        ${taskText ? `<div style="margin-bottom: 8px; font-size: 0.95em; opacity: 0.9;">"${escapedTaskText}"</div>` : ''}

        <span id="current-settings-${assignedTaskId}">
          🔁 ${getLabel('notify.recurringStatus', { vars: { frequency: '<strong>' + frequency + '</strong>', pattern } })}
        </span><br>

        <button class="show-quick-actions"
                data-task-id="${assignedTaskId}"
                style="margin-top: 8px; padding: 6px 12px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.9em;">
          ${getLabel('notify.changeSettings')}
        </button>

        <div class="quick-recurring-container"
             data-task-id="${assignedTaskId}"
             style="display: none; margin-top: 12px; opacity: 0; transform: translateY(-10px); transition: opacity 0.3s ease, transform 0.3s ease;">

          <div class="quick-recurring-options" data-task-id="${assignedTaskId}" role="radiogroup" aria-label="${getLabel('freq.frequency')}">
            <div class="quick-option" role="radio" tabindex="${frequency === 'hourly' ? '0' : '-1'}" aria-checked="${frequency === 'hourly'}" data-freq="hourly">
              <span class="radio-circle ${frequency === 'hourly' ? 'selected' : ''}" data-freq="hourly" aria-hidden="true"></span>
              <span class="option-label">${getLabel('freq.hourly')}</span>
            </div>
            <div class="quick-option" role="radio" tabindex="${frequency === 'daily' ? '0' : '-1'}" aria-checked="${frequency === 'daily'}" data-freq="daily">
              <span class="radio-circle ${frequency === 'daily' ? 'selected' : ''}" data-freq="daily" aria-hidden="true"></span>
              <span class="option-label">${getLabel('freq.daily')}</span>
            </div>
            <div class="quick-option" role="radio" tabindex="${frequency === 'weekly' ? '0' : '-1'}" aria-checked="${frequency === 'weekly'}" data-freq="weekly">
              <span class="radio-circle ${frequency === 'weekly' ? 'selected' : ''}" data-freq="weekly" aria-hidden="true"></span>
              <span class="option-label">${getLabel('freq.weekly')}</span>
            </div>
            <div class="quick-option" role="radio" tabindex="${frequency === 'monthly' ? '0' : '-1'}" aria-checked="${frequency === 'monthly'}" data-freq="monthly">
              <span class="radio-circle ${frequency === 'monthly' ? 'selected' : ''}" data-freq="monthly" aria-hidden="true"></span>
              <span class="option-label">${getLabel('freq.monthly')}</span>
            </div>
          </div>

          <div class="quick-actions">
            <button class="apply-quick-recurring" data-task-id="${assignedTaskId}" style="display: none;">${getLabel('button.apply')}</button>
            <button class="open-recurring-settings" data-task-id="${assignedTaskId}">⚙ ${getLabel('notify.moreOptions')}</button>
          </div>
        </div>

        <button class="tip-toggle-btn"
                data-tip-id="${tipId}"
                aria-label="${getLabel('notify.showTip')}"
                style="position: absolute; bottom: 8px; right: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 14px; padding: 0; display: flex; align-items: center; justify-content: center; z-index: ${Z_INDEX.ELEVATED};">💡</button>

        <button class="close-btn"
                data-task-id="${assignedTaskId}"
                title="${getLabel('button.close')}"
                aria-label="${getLabel('notify.closeNotification')}"
                style="position: absolute; top: -7px; right: -7px; background: transparent; border: none; font-size: 16px; cursor: pointer; color: #fff; line-height: 1; padding: 0; z-index: ${Z_INDEX.ELEVATED};">✖</button>
      </div>
    `;
  }

  /**
   * Initialize recurring notification listeners (with expand/collapse support)
   */
  initRecurringNotificationListeners(notification) {
    // Close button handler
    const closeBtn = notification.querySelector(DOM_SELECTORS.CLOSE_BTN);
    if (closeBtn) {
      closeBtn._clickHandler = (e) => {
        e.stopPropagation();
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), UI_TIMEOUTS.NOTIFICATION_FADE);
      };
      _safeAddEventListener(closeBtn, "click", closeBtn._clickHandler);
    }

    // Delegate clicks inside notification
    notification._clickHandler = async (e) => {
      e.stopPropagation();

      const taskId = e.target.dataset.taskId ||
                     e.target.closest("[data-task-id]")?.dataset.taskId;

      // Handle "Change Settings" button - expand quick actions
      if (e.target.classList.contains("show-quick-actions")) {
        const changeSettingsBtn = e.target;
        const quickContainer = notification.querySelector(DOM_SELECTORS.QUICK_RECURRING_CONTAINER);

        if (quickContainer) {
          // Hide "Change Settings" button
          changeSettingsBtn.style.display = "none";

          // Show and animate quick actions container
          quickContainer.style.display = "block";

          // Force reflow for animation
          quickContainer.offsetHeight;

          // Trigger animation
          quickContainer.style.opacity = "1";
          quickContainer.style.transform = "translateY(0)";

          // Focus the currently-selected option (or first) for keyboard users
          const selectedOption = quickContainer.querySelector('.quick-option[aria-checked="true"]')
            || quickContainer.querySelector('.quick-option');
          selectedOption?.focus({ focusVisible: false });
        }
      }

      // Handle quick option clicks
      if (e.target.closest(".quick-option")) {
        this._selectQuickOption(notification, e.target.closest(".quick-option"));
      }

      // Handle apply button clicks
      if (e.target.classList.contains("apply-quick-recurring")) {
        const selectedCircle = notification.querySelector(DOM_SELECTORS.RADIO_CIRCLE_SELECTED);
        if (!selectedCircle || !taskId) return;

        const newFrequency = selectedCircle.dataset.freq;

        // ✅ Wait for core systems to be ready (AppState + data)
        await _deps.appInit?.waitForCore();

        const state = this.deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;

        // Apply recurring settings (DI-pure)
        if (this.deps.applyRecurringToTaskSchema25) {
          await this.deps.applyRecurringToTaskSchema25(taskId, { frequency: newFrequency });
        }

        const targetTask = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);
        const pattern = targetTask?.recurringSettings?.indefinitely ? "Indefinitely" : "Limited";
        const currentSettingsText = notification.querySelector(`#current-settings-${taskId}`);

        if (currentSettingsText) {
          currentSettingsText.textContent = `🔁 ${getLabel('notify.recurringStatus', { vars: { frequency: newFrequency, pattern } })}`;
          currentSettingsText.style.background = "rgba(255, 255, 255, 0.2)";
          setTimeout(() => currentSettingsText.style.background = "transparent", UI_TIMEOUTS.BG_HIGHLIGHT_RESET);
        }

        e.target.style.display = "none";
        this.showApplyConfirmation(currentSettingsText);
        if (this.deps.updateRecurringPanel) this.deps.updateRecurringPanel();
      }

      // Handle advanced settings button
      if (e.target.classList.contains("open-recurring-settings") && taskId) {
        // ✅ Wait for core systems to be ready (AppState + data)
        await _deps.appInit?.waitForCore();

        if (!this.deps.AppState?.get) {
          console.warn('⚠️ AppState not available for recurring settings');
          return;
        }
        const state = this.deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);

        let startingFrequency;
        const selectedCircle = notification.querySelector(DOM_SELECTORS.RADIO_CIRCLE_SELECTED);
        if (selectedCircle) {
          startingFrequency = selectedCircle.dataset.freq;
        } else if (task?.recurringSettings?.frequency) {
          startingFrequency = task.recurringSettings.frequency;
        }

        if (startingFrequency) {
          const freqSelect = document.getElementById(DOM_IDS.RECUR_FREQUENCY);
          if (freqSelect) {
            freqSelect.value = startingFrequency;
            freqSelect.dispatchEvent(new Event("change"));
          }
        }

        // Open recurring settings panel (DI-pure)
        if (this.deps.openRecurringSettingsPanelForTask) {
          this.deps.openRecurringSettingsPanelForTask(taskId);
        }

        const notificationEl = e.target.closest(".notification");
        if (notificationEl) {
          notificationEl.classList.remove("show");
          setTimeout(() => notificationEl.remove(), UI_TIMEOUTS.NOTIFICATION_FADE);
        }
      }
    };
    _safeAddEventListener(notification, "click", notification._clickHandler);

    // Keyboard handler: Enter/Space selects radio, Arrow keys navigate radio group
    notification._keyHandler = (e) => {
      // Enter/Space selects a quick option radio
      if (e.key === 'Enter' || e.key === ' ') {
        const quickOption = e.target.closest('.quick-option');
        if (quickOption) {
          e.preventDefault();
          this._selectQuickOption(notification, quickOption);
        }
        return;
      }

      // Arrow keys within radiogroup: move focus AND select (ARIA APG radio pattern)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentRadio = e.target.closest('.quick-option');
        if (currentRadio) {
          e.preventDefault();
          const radios = [...currentRadio.closest('.quick-recurring-options').querySelectorAll('.quick-option')];
          const idx = radios.indexOf(currentRadio);
          const isForward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
          const next = isForward
            ? (idx + 1) % radios.length
            : (idx - 1 + radios.length) % radios.length;
          this._selectQuickOption(notification, radios[next]);
          radios[next].focus();
          return;
        }

        // Outside radiogroup: Arrow Up/Down navigates between buttons
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const focusable = [...notification.querySelectorAll(
            'button, [role="radio"][tabindex="0"]'
          )].filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none');
          if (focusable.length === 0) return;
          const idx = focusable.indexOf(document.activeElement);
          const next = e.key === 'ArrowDown'
            ? (idx + 1) % focusable.length
            : (idx - 1 + focusable.length) % focusable.length;
          focusable[next].focus();
        }
      }
    };
    _safeAddEventListener(notification, "keydown", notification._keyHandler);
  }

  /**
   * Select a quick option radio in the recurring notification
   * @param {HTMLElement} notification - The notification element
   * @param {HTMLElement} quickOption - The .quick-option element to select
   * @private
   */
  _selectQuickOption(notification, quickOption) {
    const radioCircle = quickOption.querySelector(DOM_SELECTORS.RADIO_CIRCLE);
    const quickOptions = quickOption.closest(".quick-recurring-options");
    const applyButton = notification.querySelector(DOM_SELECTORS.APPLY_QUICK_RECURRING);

    // Update radio circles
    quickOptions.querySelectorAll(DOM_SELECTORS.RADIO_CIRCLE).forEach(circle => {
      circle.classList.remove("selected");
    });
    radioCircle.classList.add("selected");

    // Update aria-checked and roving tabindex on all options
    quickOptions.querySelectorAll('.quick-option').forEach(opt => {
      const isSelected = opt === quickOption;
      opt.setAttribute('aria-checked', isSelected.toString());
      opt.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    applyButton.style.display = "inline-block";
    applyButton.classList.add("show");
  }

  /**
   * 🎨 Show priority color picker notification
   * Displays a notification with color swatch buttons when a task is set to high priority.
   * The user can pick Red, Yellow, or Green before the notification dismisses.
   * DOM updates happen immediately; persistence is delegated to the onColorSelect callback
   * provided by the caller (taskCRUD.js), which owns AppState for this task.
   *
   * @param {string} currentColor - Current hex color value (#dc3545, #facc15, or #28a745)
   * @param {number} [duration=8000] - How long to show the notification before auto-dismiss
   * @param {string|null} [taskId=null] - Task ID for immediate DOM update
   * @param {Function|null} [onColorSelect=null] - Callback(color) to persist the chosen color
   */
  showPriorityColorPickerNotification(currentColor = '#dc3545', duration = 8000, taskId = null, onColorSelect = null) {
    const vocabThemeId = document.documentElement.dataset?.vocabTheme;
    const activeThemeDef = (vocabThemeId && vocabThemeId !== 'classic') ? _deps.vocabThemeManager?.getThemeDefinition(vocabThemeId) : null;
    const COLORS = activeThemeDef?.priorityColors
      ? activeThemeDef.priorityColors.map(c => ({ hex: c.hex, label: getLabel(c.labelKey) }))
      : [
          { hex: '#dc3545', label: getLabel('notify.priorityColorRed') },
          { hex: '#facc15', label: getLabel('notify.priorityColorYellow') },
          { hex: '#28a745', label: getLabel('notify.priorityColorGreen') },
        ];

    const swatchesHTML = COLORS.map(c => {
      const isSelected = c.hex === currentColor;
      const dotOpacity = isSelected ? '1' : '0';
      const swatchOutline = isSelected ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent';
      return `<button class="priority-color-btn"
                       data-color="${c.hex}"
                       role="radio"
                       aria-checked="${isSelected}"
                       aria-label="${c.label}"
                       title="${c.label}"
                       style="display:flex;align-items:center;gap:5px;background:none;border:none;cursor:pointer;padding:2px;flex-shrink:0;">
        <span class="priority-radio-dial" style="width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;">
          <span class="priority-radio-dot" style="width:4px;height:4px;border-radius:50%;background:white;display:block;opacity:${dotOpacity};transition:opacity 0.15s;"></span>
        </span>
        <span class="priority-swatch" style="width:20px;height:20px;border-radius:50%;background:${c.hex};display:block;flex-shrink:0;border:1px solid rgba(0,0,0,0.35);outline:${swatchOutline};outline-offset:1px;transition:outline 0.15s;"></span>
      </button>`;
    }).join('');

    const html = `
      <div class="priority-color-picker" style="padding:10px 38px 10px 14px;min-width:180px;">
        <div style="margin-bottom:6px;font-size:0.95em;">${getLabel('notify.priorityEnabled')}</div>
        <div style="margin-bottom:6px;font-size:0.82em;opacity:0.85;">${getLabel('notify.priorityColorPicker')}</div>
        <div class="priority-color-options"
             role="radiogroup"
             aria-label="${getLabel('notify.priorityColorPicker')}"
             style="display:flex;gap:10px;align-items:center;">
          ${swatchesHTML}
        </div>
        <button class="notification-close"
                style="position:absolute;top:6px;right:6px;background:transparent;border:none;font-size:16px;cursor:pointer;color:#fff;line-height:1;padding:0;"
                aria-label="${getLabel('notify.closeNotification')}">✖</button>
      </div>
    `;

    // Dismiss any existing color picker so a second task's picker isn't blocked
    // by the duplicate-ID check (both produce identical HTML → same hash → skipped)
    const notifContainer = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
    if (notifContainer) {
      const existingPicker = notifContainer.querySelector('.priority-color-picker');
      if (existingPicker) {
        const existingNotif = existingPicker.closest(DOM_SELECTORS.NOTIFICATION);
        if (existingNotif) existingNotif.remove();
      }
    }

    const notification = this.showWithTip(html, 'warning', duration, null, { trusted: true });
    if (!notification) return;

    // Attach color-picker interaction
    notification._colorPickerClickHandler = async (e) => {
      const btn = e.target.closest('.priority-color-btn');
      if (!btn) return;

      const color = btn.dataset.color;

      // Update radio dial and swatch ring for each option
      notification.querySelectorAll('.priority-color-btn').forEach(b => {
        const selected = b === btn;
        const bColor = b.dataset.color;
        // Radio dial inner dot
        const dot = b.querySelector('.priority-radio-dot');
        if (dot) dot.style.opacity = selected ? '1' : '0';
        // Swatch selected outline
        const swatch = b.querySelector('.priority-swatch');
        if (swatch) {
          swatch.style.outline = selected ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent';
        }
        b.setAttribute('aria-checked', selected.toString());
      });

      // Apply color to the specific task's DOM element immediately (visual-only)
      if (taskId) {
        const taskEl = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskEl) taskEl.style.setProperty('--task-priority-color', color);
      }

      // Delegate persistence to caller — notifications.js has no AppState responsibility here
      if (typeof onColorSelect === 'function') {
        try {
          await onColorSelect(color);
        } catch (err) {
          console.warn('⚠️ onColorSelect callback failed:', err);
        }
      }
    };
    _safeAddEventListener(notification, 'click', notification._colorPickerClickHandler);
  }

  /**
   * ✨ Show confirmation message after applying changes
   */
  showApplyConfirmation(targetElement) {
    const tempConfirm = document.createElement("span");
    tempConfirm.textContent = "✨  " + getLabel('notify.applied');
    tempConfirm.style.color = "#209b17ff";
    tempConfirm.style.fontWeight = "bold";
    tempConfirm.style.marginLeft = "8px";
    tempConfirm.style.opacity = "0";
    const reducedMotion = this.deps.GlobalUtils?.prefersReducedMotion?.() ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fadeDuration = reducedMotion ? '0ms' : '0.3s';
    tempConfirm.style.transition = `opacity ${fadeDuration} ease`;
    
    if (targetElement) {
      targetElement.appendChild(tempConfirm);
      
      setTimeout(() => {
        tempConfirm.style.opacity = "1";
      }, 100);
      
      setTimeout(() => {
        tempConfirm.style.opacity = "0";
        setTimeout(() => {
          if (tempConfirm.parentNode) {
            tempConfirm.parentNode.removeChild(tempConfirm);
          }
        }, 300);
      }, 2000);
    }
  }

  /**
   * ❓ Show confirmation modal
   *
   * ⚠️ SECURITY: title and message are HTML-escaped by default to prevent XSS.
   * Set trustedHTML: true ONLY if you're passing pre-escaped content.
   */
  showConfirmationModal({
    title = getLabel('notify.confirmAction'),
    message = getLabel('notify.areYouSure'),
    confirmText = getLabel('button.yes'),
    cancelText = getLabel('button.cancel'),
    callback = () => {},
    trustedHTML = false,  // Set to true to skip escaping (DANGEROUS - only for pre-escaped content)
    destructive = false   // Set to true for delete/remove actions (red confirm button)
  }) {
    // ✅ XSS PROTECTION: Escape all user-facing strings by default
    const escape = getEscapeHtml(this.deps);
    const safeTitle = trustedHTML ? title : escape(title);
    const safeMessage = trustedHTML ? message : escape(message);
    const safeConfirmText = trustedHTML ? confirmText : escape(confirmText);
    const safeCancelText = trustedHTML ? cancelText : escape(cancelText);

    const overlay = document.createElement("dialog");
    overlay.className = "mini-modal-dialog";

    const modal = document.createElement("div");
    modal.className = "mini-modal-box has-corner-logo";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");

    modal.innerHTML = `
      <div class="mini-modal-header">${safeTitle}</div>
      <div class="mini-modal-body">${safeMessage}</div>
      <div class="mini-modal-buttons">
        <button class="btn-cancel">${safeCancelText}</button>
        <button class="btn-confirm${destructive ? ' btn-destructive' : ''}">${safeConfirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.showModal();

    const confirmBtn = modal.querySelector(DOM_SELECTORS.BTN_CONFIRM);
    const cancelBtn = modal.querySelector(DOM_SELECTORS.BTN_CANCEL);

    setTimeout(() => cancelBtn.focus({ focusVisible: false }), 20);

    let handleKeydown = null;

    const cleanup = () => {
      if (handleKeydown) document.removeEventListener("keydown", handleKeydown);
      overlay.close();
      overlay.remove();
    };

    // For non-destructive modals, Enter anywhere confirms (after a delay to avoid
    // catching the same keypress that opened the modal). For destructive modals,
    // skip this — user must explicitly Tab to Confirm and press Enter.
    if (!destructive) {
      handleKeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        }
      };
      setTimeout(() => {
        _safeAddEventListener(document, "keydown", handleKeydown);
      }, 100);
    }

    overlay.addEventListener('cancel', (e) => {
      e.preventDefault();
      cancelBtn.click();
    });

    confirmBtn.onclick = () => {
      cleanup();
      callback(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      callback(false);
    };
  }

  /**
   * 🔀 Show choice modal with multiple options
   *
   * Presents a modal with N choice buttons and a cancel button.
   * Used when the user needs to pick between distinct actions (not just confirm/cancel).
   *
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Modal body text
   * @param {Array<{text: string, value: string, description?: string}>} options.choices - Choice buttons
   * @param {string} [options.cancelText] - Cancel button text
   * @param {Function} options.callback - Called with choice value string, or null if cancelled
   * @param {boolean} [options.trustedHTML=false] - Skip HTML escaping (DANGEROUS)
   */
  showChoiceModal({
    title = '',
    message = '',
    choices = [],
    cancelText = getLabel('button.cancel'),
    callback = () => {},
    trustedHTML = false
  }) {
    const escape = getEscapeHtml(this.deps);
    const safeTitle = trustedHTML ? title : escape(title);
    const safeMessage = trustedHTML ? message : escape(message);
    const safeCancelText = trustedHTML ? cancelText : escape(cancelText);

    const overlay = document.createElement("dialog");
    overlay.className = "mini-modal-dialog";

    const modal = document.createElement("div");
    modal.className = "mini-modal-box has-corner-logo";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");

    // Build choice buttons HTML
    const choicesHTML = choices.map((choice, i) => {
      const safeText = trustedHTML ? choice.text : escape(choice.text);
      const safeDesc = choice.description ? (trustedHTML ? choice.description : escape(choice.description)) : '';
      return `<button class="btn-choice" data-choice-index="${i}" data-choice-value="${escape(choice.value)}">
        <span class="choice-label">${safeText}</span>
        ${safeDesc ? `<span class="choice-description">${safeDesc}</span>` : ''}
      </button>`;
    }).join('');

    modal.innerHTML = `
      <div class="mini-modal-header">${safeTitle}</div>
      <div class="mini-modal-body">${safeMessage}</div>
      <div class="mini-modal-choices">${choicesHTML}</div>
      <div class="mini-modal-buttons">
        <button class="btn-cancel">${safeCancelText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.showModal();

    const cancelBtn = modal.querySelector(DOM_SELECTORS.BTN_CANCEL);
    const choiceBtns = modal.querySelectorAll('.btn-choice');

    // Focus first choice button
    if (choiceBtns.length > 0) {
      setTimeout(() => choiceBtns[0].focus({ focusVisible: false }), 20);
    }

    const cleanup = () => {
      overlay.close();
      overlay.remove();
    };

    // Handle Escape / dialog cancel
    overlay.addEventListener('cancel', (e) => {
      e.preventDefault();
      cancelBtn.click();
    });

    // Wire choice buttons
    choiceBtns.forEach(btn => {
      btn.onclick = () => {
        cleanup();
        callback(btn.dataset.choiceValue);
      };
    });

    cancelBtn.onclick = () => {
      cleanup();
      callback(null);
    };
  }

  /**
   * 📝 Show prompt modal
   *
   * ⚠️ SECURITY: All text parameters are HTML-escaped by default to prevent XSS.
   * Set trustedHTML: true ONLY if you're passing pre-escaped content.
   */
  showPromptModal({
    title = getLabel('notify.enterValue'),
    message = "",
    placeholder = "",
    defaultValue = "",
    confirmText = getLabel('button.ok'),
    cancelText = getLabel('button.cancel'),
    required = false,
    callback = () => {},
    trustedHTML = false  // Set to true to skip escaping (DANGEROUS - only for pre-escaped content)
  }) {
    // ✅ XSS PROTECTION: Escape all user-facing strings by default
    const escape = getEscapeHtml(this.deps);
    const safeTitle = trustedHTML ? title : escape(title);
    const safeMessage = trustedHTML ? message : escape(message);
    const safePlaceholder = trustedHTML ? placeholder : escape(placeholder);
    const safeDefaultValue = trustedHTML ? defaultValue : escape(defaultValue);
    const safeConfirmText = trustedHTML ? confirmText : escape(confirmText);
    const safeCancelText = trustedHTML ? cancelText : escape(cancelText);

    const overlay = document.createElement("dialog");
    overlay.className = "miniCycle-prompt-dialog";

    overlay.innerHTML = `
      <div class="miniCycle-prompt-box has-corner-logo">
        <h2 id="miniCycle-prompt-title" class="miniCycle-prompt-title">${safeTitle}</h2>
        <p class="miniCycle-prompt-message">${safeMessage}</p>
        <input type="text" id="miniCycle-prompt-input" name="miniCycle-prompt-input" class="miniCycle-prompt-input" aria-labelledby="miniCycle-prompt-title" placeholder="${safePlaceholder}" value="${safeDefaultValue}" />
        <div class="miniCycle-prompt-buttons">
          <button class="miniCycle-btn-cancel">${safeCancelText}</button>
          <button class="miniCycle-btn-confirm">${safeConfirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.showModal();

    const input = overlay.querySelector(DOM_SELECTORS.MINI_CYCLE_PROMPT_INPUT);
    const cancelBtn = overlay.querySelector(DOM_SELECTORS.MINI_CYCLE_BTN_CANCEL);
    const confirmBtn = overlay.querySelector(DOM_SELECTORS.MINI_CYCLE_BTN_CONFIRM);

    setTimeout(() => input.focus({ focusVisible: false }), 50);

    cancelBtn._clickHandler = () => {
      overlay.close();
      overlay.remove();
      callback(null);
    };
    _safeAddEventListener(cancelBtn, "click", cancelBtn._clickHandler);

    confirmBtn._clickHandler = () => {
      const value = input.value.trim();
      if (required && !value) {
        input.classList.add("miniCycle-input-error");
        input.focus();
        return;
      }
      overlay.close();
      overlay.remove();
      callback(value);
    };
    _safeAddEventListener(confirmBtn, "click", confirmBtn._clickHandler);

    overlay.addEventListener('cancel', (e) => {
      e.preventDefault();
      cancelBtn.click();
    });

    overlay._keydownHandler = (e) => {
      if (e.key === "Enter") confirmBtn.click();
    };
    _safeAddEventListener(overlay, "keydown", overlay._keydownHandler);
  }
}

// Phase 2 Step 3 - Clean exports (no window.* pollution)
export { EducationalTipManager };

console.log('🔔 Notification system loaded (Phase 2 - no window.* exports)');