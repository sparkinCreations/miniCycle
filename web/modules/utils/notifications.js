/**
 * 🔔 MiniCycle Notifications Module (Schema 2.5 only)
 *
 * A comprehensive notification system with:
 * - Drag-enabled position persistence
 * - Educational tips management
 * - Recurring task notifications
 * - Modal dialogs (confirmation & prompt)
 * - Schema 2.5 data integration
 *
 * Usage:
 *   import { MiniCycleNotifications } from './modules/utils/notifications.js';
 *   const notifications = new MiniCycleNotifications();
 *   notifications.show("Hello World!", "success", 3000);
 *
 * @module notifications
 * @version 1.347
 * @requires AppInit (for initialization coordination)
 */

import { appInit } from './appInitialization.js';

/**
 * 🎓 Educational Tips Manager Class
 */
class EducationalTipManager {
  constructor() {
    this.dismissedTips = null; // Will be loaded lazily
  }

  loadDismissedTips() {
    console.log('📚 Loading dismissed tips (Schema 2.5 only)...');
    
    try {
      // Check if loadMiniCycleData is available in global scope
      if (typeof window.loadMiniCycleData !== 'function') {
        console.warn('⚠️ loadMiniCycleData not yet available, using fallback');
        return {};
      }

      const schemaData = window.loadMiniCycleData();
      if (!schemaData) {
        console.error('❌ Schema 2.5 data required for loadDismissedTips');
        return {};
      }

      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      return fullSchemaData.settings.dismissedEducationalTips || {};
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

  saveDismissedTips() {
    console.log('💾 Saving dismissed tips (Schema 2.5 only)...');
    
    try {
      // Check if loadMiniCycleData is available in global scope
      if (typeof window.loadMiniCycleData !== 'function') {
        console.error('❌ loadMiniCycleData not available for saveDismissedTips');
        return;
      }

      const schemaData = window.loadMiniCycleData();
      if (!schemaData) {
        console.error('❌ Schema 2.5 data required for saveDismissedTips');
        return;
      }

      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      fullSchemaData.settings.dismissedEducationalTips = this.getDismissedTips();
      fullSchemaData.metadata.lastModified = Date.now();
      localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
      
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
          <button class="tip-close" aria-label="Dismiss tip">✕</button>
        </div>
      </div>
      <button class="tip-toggle ${isDismissed ? 'show' : 'hide'}" 
              data-tip-id="${tipId}" 
              aria-label="Show educational tip">
        💡
      </button>
    `;
  }

  initializeTipListeners(container) {
    // Handle tip close buttons
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('tip-close')) {
        e.stopPropagation();
        const tipElement = e.target.closest('.educational-tip');
        const tipId = tipElement.dataset.tipId;
        this.hideTip(tipId, container);
      }
    });

    // Handle tip toggle buttons
    container.addEventListener('click', (e) => {
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
    });
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
 * 🔔 Main MiniCycle Notifications Class
 */
export class MiniCycleNotifications {
  constructor() {
    this.educationalTips = new EducationalTipManager();
    this.isDraggingNotification = false;
  }

  // Helper method to sync with global variable
  setDraggingState(isDragging) {
    this.isDraggingNotification = isDragging;
    // Also update the global variable if it exists
    if (typeof window !== 'undefined') {
      if ('isDraggingNotification' in window) {
        window.isDraggingNotification = isDragging;
      }
      // Also try to update the global variable directly if it exists in global scope
      try {
        if (typeof globalThis !== 'undefined' && 'isDraggingNotification' in globalThis) {
          globalThis.isDraggingNotification = isDragging;
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * 🎯 Core notification display function
   */
  show(message, type = "default", duration = null) {
    try {
      const notificationContainer = document.getElementById("notification-container");
      if (!notificationContainer) {
        console.warn("⚠️ Notification container not found.");
        return;
      }

      if (typeof message !== "string" || message.trim() === "") {
        console.warn("⚠️ Invalid or empty message passed to show().");
        message = "⚠️ Unknown notification";
      }

      // Note: generateHashId() must be available in global scope
      const newId = window.generateHashId(message);
      if ([...notificationContainer.querySelectorAll(".notification")]
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

      // Only add default close button if one is not already in message HTML
      if (message.includes('class="close-btn"')) {
        notification.innerHTML = message;
      } else {
        notification.innerHTML = `
          <div class="notification-content">${message}</div>
          <button class="close-btn" title="Close" aria-label="Close notification">✖</button>
        `;
      }

      // Style and handler for any close button
      const closeBtn = notification.querySelector(".close-btn");
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

        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          notification.classList.remove("show");
          setTimeout(() => notification.remove(), 300);
        });
      }

      notificationContainer.appendChild(notification);

      // Restore saved position from Schema 2.5
      this.restoreNotificationPosition(notificationContainer);

      // Auto-remove after duration (hover pause)
      console.log(`🔍 Notification debug - Type: "${type}", Duration: ${duration} (type: ${typeof duration}), Will auto-dismiss: ${!!duration}, Truthy check: ${Boolean(duration)}`);
      if (duration) {
        console.log(`⏱️ Setting up auto-remove with duration: ${duration}ms`);
        this.setupAutoRemove(notification, duration);
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
   */
  showWithTip(content, type = "default", duration = null, tipId = null) {
    try {
      const notificationContainer = document.getElementById("notification-container");
      if (!notificationContainer) {
        console.warn("⚠️ Notification container not found.");
        return;
      }

      if (typeof content !== "string" || content.trim() === "") {
        console.warn("⚠️ Invalid or empty message passed to showWithTip().");
        content = "⚠️ Unknown notification";
      }

      const newId = window.generateHashId(content);
      const existing = [...notificationContainer.querySelectorAll(".notification")];

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

      // Check if HTML already has a close button before adding one
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const hasCloseBtn = tempDiv.querySelector(".close-btn, .notification-close");

      if (hasCloseBtn) {
        notification.innerHTML = content;
      } else {
        notification.innerHTML = `
          <div class="notification-content">${content}</div>
          <button class="notification-close" aria-label="Close notification">✖</button>
        `;
      }

      notificationContainer.appendChild(notification);

      // Close button click
      const closeBtn = notification.querySelector(".close-btn, .notification-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          notification.classList.remove("show");
          setTimeout(() => notification.remove(), 300);
        });
      }

      // Initialize tip listeners if this notification has tips
      if (tipId || notification.querySelector(".educational-tip")) {
        this.educationalTips.initializeTipListeners(notification);
      }

      // Restore saved position from Schema 2.5
      this.restoreNotificationPosition(notificationContainer);

      // Auto-remove logic with hover pause
      if (duration) {
        this.setupAutoRemove(notification, duration);
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

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    // ✅ AppState.update() expects a function, not an object
    window.AppState.update((state) => {
      if (!state.settings) {
        console.error('❌ Invalid state structure');
        throw new Error('Invalid state structure');
      }
      state.settings.notificationPosition = { x: 0, y: 0 };
      state.settings.notificationPositionModified = false;
    }, true); // Immediate save

    // Reset DOM position
    const container = document.getElementById("notification-container");
    if (container) {
      container.style.top = "";
      container.style.left = "";
      container.style.right = "";
    }

    console.log("✅ Notification position reset completed (Schema 2.5)");
  }

  /**
   * 🎯 Restore notification position from Schema 2.5
   */
restoreNotificationPosition(notificationContainer) {
    try {
        // ✅ Check if loadMiniCycleData is available (may not be during early initialization)
        if (typeof window.loadMiniCycleData !== 'function') {
            console.log('⏳ loadMiniCycleData not yet available, using default position');
            this.setDefaultPosition(notificationContainer);
            return;
        }

        const schemaData = window.loadMiniCycleData();
        if (!schemaData) {
            console.log('📋 No schema data available, using default position');
            this.setDefaultPosition(notificationContainer);
            return;
        }

        const savedPosition = schemaData.settings.notificationPosition;
        if (savedPosition?.x && savedPosition?.y) {
            notificationContainer.style.top = `${savedPosition.y}px`;
            notificationContainer.style.left = `${savedPosition.x}px`;
            notificationContainer.style.right = "auto";
        } else {
            // No saved position - set a smart default
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
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Smart positioning based on screen size
    let defaultX, defaultY;

    if (viewportWidth <= 768) {
        // Mobile: Center horizontally, avoid top menu area
        defaultX = Math.max(20, (viewportWidth - 320) / 2); // Assume 320px notification width
        defaultY = 15; // Below menu area
    } else {
        // Desktop: Right side, avoid menu button (typically top-left)
        defaultX = viewportWidth - 350; // 350px from right edge
        defaultY = 15; // Below potential menu area
    }

    // Apply the position immediately (synchronous)
    notificationContainer.style.top = `${defaultY}px`;
    notificationContainer.style.left = `${defaultX}px`;
    notificationContainer.style.right = "auto";

    // Save this default position to Schema 2.5 so it persists (asynchronous, non-blocking)
    try {
        // ✅ Only save if AppState is available
        if (!window.AppState || typeof window.AppState.update !== 'function') {
            console.log('⏳ AppState not ready, position not saved (will use default next time)');
            return;
        }

        // ✅ Wait for core systems to be ready (AppState + data)
        await appInit.waitForCore();

        window.AppState.update((state) => {
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
   */
  setupAutoRemove(notification, duration) {
    console.log(`🔧 setupAutoRemove called with duration: ${duration} (type: ${typeof duration})`);
    let hoverPaused = false;
    let remaining = duration;
    let removeTimeout;
    let startTime = Date.now();

    const clearNotification = () => {
      console.log(`🗑️ Auto-removing notification after ${duration}ms`);
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    };

    const startTimer = () => {
      removeTimeout = setTimeout(() => {
        if (!hoverPaused) clearNotification();
      }, remaining);
    };

    const pauseTimer = () => {
      hoverPaused = true;
      clearTimeout(removeTimeout);
      remaining -= (Date.now() - startTime);
    };

    const resumeTimer = () => {
      hoverPaused = false;
      startTime = Date.now();
      startTimer();
    };

    startTimer();
    notification.addEventListener("mouseenter", pauseTimer);
    notification.addEventListener("mouseleave", resumeTimer);
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

    // Save position to Schema 2.5 via AppState
    const savePositionToSchema25 = async (x, y) => {
      try {
        // ✅ Wait for core systems to be ready (AppState + data)
        await appInit.waitForCore();

        // ✅ AppState.update() expects a function, not an object
        window.AppState.update((state) => {
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

    // Mouse dragging
    notificationContainer.addEventListener("mousedown", (e) => {
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

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // Touch dragging
    notificationContainer.addEventListener("touchstart", (e) => {
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

      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd, { passive: false });
    }, { passive: true });
  }

  /**
   * 🔁 Create recurring notification with educational tip (two-state: collapsed/expanded)
   */
  createRecurringNotificationWithTip(assignedTaskId, frequency, pattern, taskText = '') {
    const tipId = 'recurring-cycle-explanation';
    const tipText = 'Recurring tasks are deleted on cycle reset and reappear based on their schedule';

    const educationalTipHTML = `
      <div class="educational-tip recurring-tip" id="tip-${tipId}" data-tip-id="${tipId}" style="display: none;">
        <div class="tip-content">
          <span class="tip-icon">📍</span>
          <span class="tip-text">${tipText}</span>
          <button class="tip-close" aria-label="Dismiss tip">✕</button>
        </div>
      </div>
    `;

    // Escape HTML in task text to prevent XSS
    const escapedTaskText = taskText.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `
      <div class="main-notification-content"
           style="position: relative; display: block; padding: 12px 42px 12px 16px; border-radius: 6px;">

        <button class="close-btn"
                title="Close"
                aria-label="Close notification"
                style="position: absolute; top: -7px; right: -7px; background: transparent; border: none; font-size: 16px; cursor: pointer; color: #fff; line-height: 1; padding: 0; z-index: 10;">✖</button>

        <button class="tip-toggle-btn"
                data-tip-id="${tipId}"
                aria-label="Show educational tip"
                style="position: absolute; bottom: 8px; right: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 14px; padding: 0; display: flex; align-items: center; justify-content: center; z-index: 5;">💡</button>

        ${educationalTipHTML}

        ${taskText ? `<div style="margin-bottom: 8px; font-size: 0.95em; opacity: 0.9;">"${escapedTaskText}"</div>` : ''}

        <span id="current-settings-${assignedTaskId}">
          🔁 Recurring set to <strong>${frequency}</strong> (${pattern})
        </span><br>

        <button class="show-quick-actions"
                data-task-id="${assignedTaskId}"
                style="margin-top: 8px; padding: 6px 12px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.9em;">
          Change Settings
        </button>

        <div class="quick-recurring-container"
             data-task-id="${assignedTaskId}"
             style="display: none; margin-top: 12px; opacity: 0; transform: translateY(-10px); transition: opacity 0.3s ease, transform 0.3s ease;">

          <div class="quick-recurring-options" data-task-id="${assignedTaskId}">
            <div class="quick-option">
              <span class="radio-circle ${frequency === 'hourly' ? 'selected' : ''}" data-freq="hourly"></span>
              <span class="option-label">Hourly</span>
            </div>
            <div class="quick-option">
              <span class="radio-circle ${frequency === 'daily' ? 'selected' : ''}" data-freq="daily"></span>
              <span class="option-label">Daily</span>
            </div>
            <div class="quick-option">
              <span class="radio-circle ${frequency === 'weekly' ? 'selected' : ''}" data-freq="weekly"></span>
              <span class="option-label">Weekly</span>
            </div>
            <div class="quick-option">
              <span class="radio-circle ${frequency === 'monthly' ? 'selected' : ''}" data-freq="monthly"></span>
              <span class="option-label">Monthly</span>
            </div>
          </div>

          <div class="quick-actions">
            <button class="apply-quick-recurring" data-task-id="${assignedTaskId}" style="display: none;">Apply</button>
            <button class="open-recurring-settings" data-task-id="${assignedTaskId}">⚙ More Options</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 🎛️ Initialize recurring notification listeners (with expand/collapse support)
   */
  initializeRecurringNotificationListeners(notification) {
    // Close button handler
    const closeBtn = notification.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      });
    }

    // Delegate clicks inside notification
    notification.addEventListener("click", async (e) => {
      e.stopPropagation();

      const taskId = e.target.dataset.taskId ||
                     e.target.closest("[data-task-id]")?.dataset.taskId;

      // Handle "Change Settings" button - expand quick actions
      if (e.target.classList.contains("show-quick-actions")) {
        const changeSettingsBtn = e.target;
        const quickContainer = notification.querySelector(".quick-recurring-container");

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
        }
      }

      // Handle quick option clicks
      if (e.target.closest(".quick-option")) {
        const quickOption = e.target.closest(".quick-option");
        const radioCircle = quickOption.querySelector(".radio-circle");
        const quickOptions = quickOption.closest(".quick-recurring-options");
        const applyButton = notification.querySelector(".apply-quick-recurring");

        quickOptions.querySelectorAll(".radio-circle").forEach(circle => {
          circle.classList.remove("selected");
        });

        radioCircle.classList.add("selected");
        applyButton.style.display = "inline-block";
        applyButton.classList.add("show");
      }

      // Handle apply button clicks
      if (e.target.classList.contains("apply-quick-recurring")) {
        const selectedCircle = notification.querySelector(".radio-circle.selected");
        if (!selectedCircle || !taskId) return;

        const newFrequency = selectedCircle.dataset.freq;

        // ✅ Wait for core systems to be ready (AppState + data)
        await appInit.waitForCore();

        const state = window.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;

        // Note: applyRecurringToTaskSchema25 must be available in global scope
        window.applyRecurringToTaskSchema25(taskId, { frequency: newFrequency });

        const targetTask = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);
        const pattern = targetTask?.recurringSettings?.indefinitely ? "Indefinitely" : "Limited";
        const currentSettingsText = notification.querySelector(`#current-settings-${taskId}`);

        if (currentSettingsText) {
          currentSettingsText.innerHTML = `🔁 Recurring set to <strong>${newFrequency}</strong> (${pattern})`;
          currentSettingsText.style.background = "rgba(255, 255, 255, 0.2)";
          setTimeout(() => currentSettingsText.style.background = "transparent", 800);
        }

        e.target.style.display = "none";
        this.showApplyConfirmation(currentSettingsText);
        if (window.updateRecurringPanel) window.updateRecurringPanel();
      }

      // Handle advanced settings button
      if (e.target.classList.contains("open-recurring-settings") && taskId) {
        // ✅ Wait for core systems to be ready (AppState + data)
        await appInit.waitForCore();

        const state = window.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);

        let startingFrequency;
        const selectedCircle = notification.querySelector(".radio-circle.selected");
        if (selectedCircle) {
          startingFrequency = selectedCircle.dataset.freq;
        } else if (task?.recurringSettings?.frequency) {
          startingFrequency = task.recurringSettings.frequency;
        }

        if (startingFrequency) {
          const freqSelect = document.getElementById("recur-frequency");
          if (freqSelect) {
            freqSelect.value = startingFrequency;
            freqSelect.dispatchEvent(new Event("change"));
          }
        }

        // Note: openRecurringSettingsPanelForTask must be available in global scope
        if (window.openRecurringSettingsPanelForTask) {
          window.openRecurringSettingsPanelForTask(taskId);
        }

        const notificationEl = e.target.closest(".notification");
        if (notificationEl) {
          notificationEl.classList.remove("show");
          setTimeout(() => notificationEl.remove(), 300);
        }
      }
    });
  }

  /**
   * ✨ Show confirmation message after applying changes
   */
  showApplyConfirmation(targetElement) {
    const tempConfirm = document.createElement("span");
    tempConfirm.textContent = "✨  Applied!";
    tempConfirm.style.color = "#209b17ff";
    tempConfirm.style.fontWeight = "bold";
    tempConfirm.style.marginLeft = "8px";
    tempConfirm.style.opacity = "0";
    tempConfirm.style.transition = "opacity 0.3s ease";
    
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
   */
  showConfirmationModal({
    title = "Confirm Action",
    message = "Are you sure?",
    confirmText = "Yes",
    cancelText = "Cancel",
    callback = () => {}
  }) {
    const overlay = document.createElement("div");
    overlay.className = "mini-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "mini-modal-box";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");

    modal.innerHTML = `
      <div class="mini-modal-header">${title}</div>
      <div class="mini-modal-body">${message}</div>
      <div class="mini-modal-buttons">
        <button class="btn-confirm">${confirmText}</button>
        <button class="btn-cancel">${cancelText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const confirmBtn = modal.querySelector(".btn-confirm");
    const cancelBtn = modal.querySelector(".btn-cancel");

    setTimeout(() => cancelBtn.focus(), 20);

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.removeChild(overlay);
    };

    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelBtn.click();
      }
    };

    document.addEventListener("keydown", handleKeydown);

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
   * 📝 Show prompt modal
   */
  showPromptModal({
    title = "Enter a value",
    message = "",
    placeholder = "",
    defaultValue = "",
    confirmText = "OK",
    cancelText = "Cancel",
    required = false,
    callback = () => {}
  }) {
    const overlay = document.createElement("div");
    overlay.className = "miniCycle-overlay";

    overlay.innerHTML = `
      <div class="miniCycle-prompt-box">
        <h2 class="miniCycle-prompt-title">${title}</h2>
        <p class="miniCycle-prompt-message">${message}</p>
        <input type="text" class="miniCycle-prompt-input" placeholder="${placeholder}" value="${defaultValue}" />
        <div class="miniCycle-prompt-buttons">
          <button class="miniCycle-btn-cancel">${cancelText}</button>
          <button class="miniCycle-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector(".miniCycle-prompt-input");
    const cancelBtn = overlay.querySelector(".miniCycle-btn-cancel");
    const confirmBtn = overlay.querySelector(".miniCycle-btn-confirm");

    setTimeout(() => input.focus(), 50);

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      callback(null);
    });

    confirmBtn.addEventListener("click", () => {
      const value = input.value.trim();
      if (required && !value) {
        input.classList.add("miniCycle-input-error");
        input.focus();
        return;
      }
      document.body.removeChild(overlay);
      callback(value);
    });

    overlay.addEventListener("keydown", e => {
      if (e.key === "Enter") confirmBtn.click();
      if (e.key === "Escape") cancelBtn.click();
    });
  }
}

// Export both the main class and the tip manager for flexibility
export { EducationalTipManager };

// Expose to window for testing and global access
window.MiniCycleNotifications = MiniCycleNotifications;
window.EducationalTipManager = EducationalTipManager;

console.log('🔔 Notification system loaded and ready');
console.log('  - MiniCycleNotifications:', typeof window.MiniCycleNotifications);
console.log('  - EducationalTipManager:', typeof window.EducationalTipManager);