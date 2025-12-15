/**
 * ============================================================================
 * uiBoot.js - UI Event Handlers & Helpers
 * ============================================================================
 * Location: modules/boot/uiBoot.js
 *
 * This file handles:
 * - All global DOM event listeners
 * - UI helper functions (loaders, etc.)
 * - Device detection fallback
 *
 * RESPONSIBILITIES:
 * - Attach global event listeners
 * - Handle keyboard shortcuts
 * - UI utilities like loader/spinner
 *
 * IMPORT RULES:
 * - This file CAN import from coreBoot.js
 * - This file CAN import from featureBoot.js
 * - This file should NOT expose services to window.* (featureBoot does that)
 *
 * ============================================================================
 */

// Import appContext getters for DI access (grouped APIs preferred)
import {
  getAppState,
  getShowNotification,
  getStateApi,
  getTaskApi,
  getUndoApi,
  getUiApi,
  getCycleApi,
  getReminderApi,
  getDeviceDetectionManager
} from '../core/appContext.js';

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

/**
 * Attach all global event listeners
 * Called from orchestrator.js after modules are loaded
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {Object} options - Configuration options
 */
export function attachGlobalEventListeners(GlobalUtils, options = {}) {
  const { safeAddEventListener, safeAddEventListenerById } = GlobalUtils;

  // ========== Keyboard Shortcuts ==========
  safeAddEventListener(document, 'keydown', handleGlobalKeydown);

  // ========== Global Click: Hide Task Buttons ==========
  safeAddEventListener(document, 'click', handleGlobalClickForTaskButtons);

  // ========== Global Click: Deselect in Switch Modal ==========
  safeAddEventListener(document, 'click', handleGlobalClickForSwitchModal);

  // ========== Reset Notification Position ==========
  safeAddEventListenerById('reset-notification-position', 'click', handleResetNotificationPosition);

  // ========== Open Reminders Modal ==========
  safeAddEventListenerById('open-reminders-modal', 'click', handleOpenRemindersModalClick);

  // ========== First Touch Interaction ==========
  safeAddEventListener(document, 'touchstart', handleFirstTouchInteraction, { once: true, passive: true });

  // ========== Passive Touchstart (for scroll performance) ==========
  safeAddEventListener(document, 'touchstart', handlePassiveTouchstart, { passive: true });

  console.log('✅ Global event listeners attached via uiBoot.js');
}

/**
 * Attach task input event listeners
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {HTMLElement} taskInput - Task input element
 * @param {HTMLElement} addTaskButton - Add task button element
 */
export function attachTaskInputListeners(GlobalUtils, taskInput, addTaskButton) {
  const { safeAddEventListener } = GlobalUtils;

  // Add Task Button (Click)
  if (addTaskButton) {
    safeAddEventListener(addTaskButton, 'click', () => {
      // Enable undo system on first user interaction
      try {
        getUndoApi()?.enableOnFirstInteraction?.();
      } catch (e) {
        // API not ready yet - ok during early boot
      }

      const taskText = taskInput?.value?.trim() || '';
      if (!taskText) {
        console.warn('⚠ Cannot add an empty task.');
        return;
      }

      try {
        getTaskApi()?.add?.(taskText);
      } catch (e) {
        console.error('❌ Failed to add task:', e);
      }
      taskInput.value = '';
    });
  }

  // Task Input (Enter Key)
  if (taskInput) {
    safeAddEventListener(taskInput, 'keypress', (event) => {
      if (event.key === 'Enter') {
        // Enable undo system on first user interaction
        try {
          getUndoApi()?.enableOnFirstInteraction?.();
        } catch (e) {
          // API not ready yet - ok during early boot
        }

        event.preventDefault();
        const taskText = taskInput.value?.trim() || '';
        if (!taskText) {
          console.warn('⚠ Cannot add an empty task.');
          return;
        }

        try {
          getTaskApi()?.add?.(taskText);
        } catch (e) {
          console.error('❌ Failed to add task:', e);
        }
        taskInput.value = '';
      }
    });
  }

  console.log('✅ Task input listeners attached');
}

/**
 * Attach menu button event listener
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {HTMLElement} menuButton - Menu button element
 * @param {HTMLElement} menu - Menu container element
 */
export function attachMenuButtonListener(GlobalUtils, menuButton, menu) {
  const { safeAddEventListener } = GlobalUtils;

  if (menuButton && menu) {
    safeAddEventListener(menuButton, 'click', (event) => {
      event.stopPropagation();

      // Sync settings before showing menu
      try {
        getUiApi()?.syncCurrentSettingsToStorage?.();
        getCycleApi()?.saveToggleAutoReset?.();
      } catch (e) {
        // APIs may not be ready - that's ok
      }

      menu.classList.toggle('visible');

      if (menu.classList.contains('visible')) {
        safeAddEventListener(document, 'click', closeMenuOnClickOutside);
      }
    });
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Global keyboard shortcut handler
 */
function handleGlobalKeydown(e) {
  // Undo: Ctrl/Cmd + Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    try {
      getUndoApi()?.undo?.();
    } catch (err) {
      console.warn('⚠️ Undo not available:', err);
    }
  }

  // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    try {
      getUndoApi()?.redo?.();
    } catch (err) {
      console.warn('⚠️ Redo not available:', err);
    }
  }
}

/**
 * Global click handler for hiding task option buttons
 */
function handleGlobalClickForTaskButtons(event) {
  const isTaskOrOptionsClick = event.target.closest('.task, .task-options');
  const isModalClick = event.target.closest('.modal, .mini-modal-overlay, .settings-modal, .notification');

  if (!isTaskOrOptionsClick && !isModalClick) {
    console.log('✅ Clicking outside - closing task buttons');

    const threeDotsEnabled = document.body.classList.contains('show-three-dots-enabled');

    document.querySelectorAll('.task-options').forEach(action => {
      if (threeDotsEnabled) {
        action.style.opacity = '0';
        action.style.visibility = 'hidden';
        action.style.pointerEvents = 'none';
      } else {
        action.style.opacity = '';
        action.style.visibility = '';
        action.style.pointerEvents = '';
      }
    });

    document.querySelectorAll('.task').forEach(task => {
      task.classList.remove('long-pressed', 'draggable', 'dragging');

      // Keep selections in recurring panel
      const recurringPanel = document.getElementById('recurring-panel-overlay');
      if (!recurringPanel?.classList.contains('hidden')) {
        // Keep selections
      } else {
        task.classList.remove('selected');
      }
    });
  }
}

/**
 * Global click handler for deselecting in switch modal
 */
function handleGlobalClickForSwitchModal(event) {
  const switchModalContent = document.querySelector('.mini-cycle-switch-modal-content');
  const selectedCycle = document.querySelector('.mini-cycle-switch-item.selected');
  const switchItemsRow = document.getElementById('switch-items-row');
  const previewWindow = document.querySelector('.switch-preview-window');

  if (
    switchModalContent?.contains(event.target) &&
    selectedCycle &&
    !event.target.classList.contains('mini-cycle-switch-item') &&
    !previewWindow?.contains(event.target)
  ) {
    selectedCycle.classList.remove('selected');
    if (switchItemsRow) {
      switchItemsRow.style.display = 'none';
    }
    if (previewWindow) {
      previewWindow.innerHTML = '<p style="color: #888; font-style: italic;">Select a miniCycle to preview</p>';
    }
  }
}

/**
 * Handle reset notification position click
 */
async function handleResetNotificationPosition() {
  console.log('🔄 Resetting notification position (Schema 2.5 only)...');

  // Use appContext getters
  const AppState = getAppState();
  const showNotification = getShowNotification();

  if (!AppState?.isReady?.()) {
    console.error('❌ AppState not ready for reset notification position');
    showNotification?.('❌ Unable to reset position.', 'error', 2000);
    return;
  }

  try {
    await AppState.update(state => {
      if (!state?.settings) {
        state.settings = {};
      }
      state.settings.notificationPosition = { x: 0, y: 0 };
      state.settings.notificationPositionModified = false;
    }, true);

    console.log('✅ Notification position reset in Schema 2.5');

    // Use grouped API
    try {
      getUiApi()?.resetNotificationPosition?.();
    } catch (e) {
      console.warn('⚠️ Could not reset notification position UI:', e);
    }

    showNotification?.('🔄 Notification position reset.', 'success', 2000);
  } catch (error) {
    console.error('❌ Failed to reset notification position:', error);
    showNotification?.('❌ Failed to reset position.', 'error', 2000);
  }
}

/**
 * Handle open reminders modal click
 */
function handleOpenRemindersModalClick() {
  console.log('🔔 Opening reminders modal (Schema 2.5 only)...');

  // Use grouped APIs
  try {
    getReminderApi()?.loadSettings?.();
  } catch (e) {
    console.warn('⚠️ Could not load reminder settings:', e);
  }

  const modal = document.getElementById('reminders-modal');
  if (modal) {
    modal.style.display = 'flex';
  }

  try {
    getUiApi()?.hideMainMenu?.();
  } catch (e) {
    // Menu API not ready - ok
  }

  console.log('✅ Reminders modal opened');
}

/**
 * Handle first touch interaction (for enabling audio, etc.)
 */
function handleFirstTouchInteraction() {
  // Use grouped API
  try {
    const stateApi = getStateApi();
    if (stateApi?.AppGlobalState) {
      stateApi.AppGlobalState.hasInteracted = true;
    }
  } catch (e) {
    // stateApi not registered yet - fallback silently
    console.warn('⚠️ First touch before stateApi ready');
  }
  console.log('✅ First touch interaction detected');
}

/**
 * Passive touchstart handler (for scroll performance)
 */
function handlePassiveTouchstart() {
  // Empty - just ensures passive listener is registered
}

/**
 * Close menu when clicking outside
 */
function closeMenuOnClickOutside(event) {
  const menu = document.querySelector('.menu-container');
  const menuButton = document.querySelector('.menu-button');

  if (menu && !menu.contains(event.target) && !menuButton?.contains(event.target)) {
    menu.classList.remove('visible');
    document.removeEventListener('click', closeMenuOnClickOutside);
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Hide the app loader/splash screen
 */
export function hideAppLoader() {
  setTimeout(() => {
    const appLoader = document.getElementById('app-loader');
    if (appLoader) {
      appLoader.classList.add('fade-out');
      setTimeout(() => {
        appLoader.style.display = 'none';
        // Signal successful load via dataset (HTML checks this instead of window.*)
        document.documentElement.dataset.appLoaded = 'true';
      }, 500);
    }
  }, 500);
}

/**
 * Show a loading spinner with message
 * @param {string} message - Loading message to display
 */
export function showLoader(message = 'Processing...') {
  const overlay = document.getElementById('loading-overlay');
  const textElement = overlay?.querySelector('.loading-spinner-text');

  if (overlay) {
    if (textElement && message) {
      textElement.textContent = message;
    }
    overlay.classList.add('active');
  }
}

/**
 * Hide the loading spinner
 */
export function hideLoader() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

/**
 * Wraps an async operation with loading indicator
 * @param {Function} asyncFunction - Async function to execute
 * @param {string} message - Loading message to display
 * @returns {Promise} - Result of the async function
 */
export async function withLoader(asyncFunction, message = 'Processing...') {
  try {
    showLoader(message);
    const result = await asyncFunction();
    return result;
  } finally {
    hideLoader();
  }
}

// NOTE: Loader functions are accessed via uiApi grouped API, not window.*
// featureBoot.js registers them: getUiApi().showLoader, getUiApi().hideLoader, etc.

// ============================================================================
// DEVICE DETECTION FALLBACK
// ============================================================================

/**
 * Fallback device detection if module fails to load
 */
export function detectDeviceType() {
  // Check if device detection manager loaded via appContext
  try {
    const deviceManager = getDeviceDetectionManager();
    if (deviceManager) {
      return; // Module loaded, use that instead
    }
  } catch (e) {
    // Not registered yet - use fallback
  }

  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const isTouchDeviceCheck = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isFinePointer && !isTouchDeviceCheck) {
    document.body.classList.add('desktop-mode');
    document.body.classList.remove('touch-mode');
  } else {
    document.body.classList.add('touch-mode');
    document.body.classList.remove('desktop-mode');
  }

  console.log('✅ Device type detected (fallback):', isFinePointer ? 'desktop' : 'touch');
}

/**
 * Check if device is touch-capable
 * @returns {boolean} True if touch device
 */
export function isTouchDevice() {
  return 'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    !window.matchMedia('(pointer: fine)').matches;
}

// NOTE: isTouchDevice is exported and registered via featureBoot to appContext
// Consumers should use it via import or grouped API, not window.*

// ============================================================================
// MODULE INFO
// ============================================================================

console.log('📱 uiBoot.js loaded (UI event handlers & helpers)');
