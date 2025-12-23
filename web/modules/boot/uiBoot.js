/**
 * ============================================================================
 * uiBoot.js - UI Event Handlers & Helpers
 * ============================================================================
 * Location: modules/boot/uiBoot.js
 *
 * This file handles ALL UI setup via the initUIBoot() entrypoint:
 * - All global DOM event listeners
 * - UI helper functions (loaders, etc.)
 * - Device detection fallback
 * - DOM queries and listener attachment
 * - Loader hiding and input focus
 *
 * MAIN ENTRYPOINT:
 * - initUIBoot({ GlobalUtils, deps, appContextMod })
 *   Called by orchestrator.js after data load
 *
 * ARCHITECTURE (Dec 2025):
 * - orchestrator.js is a pure sequence controller (no UI logic)
 * - uiBoot.js owns ALL UI setup via initUIBoot()
 * - Zero window.* globals
 *
 * IMPORT RULES:
 * - This file CAN import from coreBoot.js
 * - This file CAN import from featureBoot.js
 * - This file uses appContext.js getters for cross-module access
 *
 * @version 2.0.0
 * ============================================================================
 */

// ============================================================================
// APPCONTEXT DYNAMIC IMPORT
// ============================================================================
// NOTE: Early imports before DI use unversioned paths. Service worker handles
// cache invalidation. This avoids hardcoded fallback versions that get stale.
let _appContextModule = null;
let getAppState = () => { console.warn('⚠️ appContext not loaded yet'); return null; };
let getShowNotification = () => null;
let getStateApi = () => null;
let getTaskApi = () => null;
let getUndoApi = () => null;
let getUiApi = () => null;
let getCycleApi = () => null;
let getReminderApi = () => null;
let getDeviceDetectionManager = () => null;

async function loadAppContext() {
    if (!_appContextModule) {
        // No version param - early import before DI, service worker handles cache
        _appContextModule = await import('../core/appContext.js');
        // Update the module-level getters
        getAppState = _appContextModule.getAppState;
        getShowNotification = _appContextModule.getShowNotification;
        getStateApi = _appContextModule.getStateApi;
        getTaskApi = _appContextModule.getTaskApi;
        getUndoApi = _appContextModule.getUndoApi;
        getUiApi = _appContextModule.getUiApi;
        getCycleApi = _appContextModule.getCycleApi;
        getReminderApi = _appContextModule.getReminderApi;
        getDeviceDetectionManager = _appContextModule.getDeviceDetectionManager;
        console.log('✅ uiBoot: appContext loaded');
    }
    return _appContextModule;
}

// Load appContext early (non-blocking)
loadAppContext().catch(e => console.warn('⚠️ uiBoot: Failed to load appContext:', e));

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
 * @param {Object} appContextMod - appContext module (versioned import)
 */
export function attachTaskInputListeners(GlobalUtils, taskInput, addTaskButton, appContextMod) {
  const { safeAddEventListener } = GlobalUtils;

  // Add Task Button (Click)
  if (addTaskButton) {
    safeAddEventListener(addTaskButton, 'click', () => {
      console.log('🔘 Add Task button clicked');
      // Enable undo system on first user interaction
      try {
        appContextMod?.getUndoApi?.()?.enableOnFirstInteraction?.();
      } catch (e) {
        // API not ready yet - ok during early boot
      }

      const taskText = taskInput?.value?.trim() || '';
      console.log('📝 Task text:', taskText);
      if (!taskText) {
        console.warn('⚠ Cannot add an empty task.');
        return;
      }

      try {
        const taskApi = appContextMod.getTaskApi();
        console.log('🔍 TaskAPI:', taskApi);
        console.log('🔍 TaskAPI.add:', taskApi?.add);
        taskApi?.add?.(taskText);
      } catch (e) {
        console.error('❌ Failed to add task:', e);
      }
      taskInput.value = '';
    });
  } else {
    console.warn('⚠️ addTaskButton element not found!');
  }

  // Task Input (Enter Key)
  if (taskInput) {
    safeAddEventListener(taskInput, 'keypress', (event) => {
      if (event.key === 'Enter') {
        console.log('⌨️ Enter key pressed');
        // Enable undo system on first user interaction
        try {
          appContextMod?.getUndoApi?.()?.enableOnFirstInteraction?.();
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
          const taskApi = appContextMod.getTaskApi();
          taskApi?.add?.(taskText);
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
  const isUndoRedoClick = event.target.closest('#undo-btn, #redo-btn, .undo-btn, .redo-btn');

  if (!isTaskOrOptionsClick && !isModalClick && !isUndoRedoClick) {
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
 * Check if any overlay/modal is currently active
 * Used by various modules to determine if UI interactions should be blocked
 * @returns {boolean} True if an overlay is active
 */
export function isOverlayActive() {
  if (document.querySelector(".menu-container.visible")) return true;

  const overlaySelectors = [
    '.settings-modal[style*="display: flex"]',
    '.mini-cycle-switch-modal[style*="display: flex"]',
    '#feedback-modal[style*="display: flex"]',
    '#about-modal[style*="display: flex"]',
    '#themes-modal[style*="display: flex"]',
    '#games-panel[style*="display: flex"]',
    '#reminders-modal[style*="display: flex"]',
    '#testing-modal[style*="display: flex"]',
    '#recurring-panel-overlay:not(.hidden)',
    '.notification-container .notification',
    '#storage-viewer-overlay:not(.hidden)',
    '.mini-modal-overlay',
    '.miniCycle-overlay',
    '.onboarding-modal:not([style*="display: none"])'
  ];

  return overlaySelectors.some(selector => document.querySelector(selector));
}

/**
 * Update navigation dots for task/stats panel switching
 */
export function updateNavDots() {
  const statsPanel = document.getElementById("stats-panel");
  const statsVisible = statsPanel && statsPanel.classList.contains("show");
  const dots = document.querySelectorAll(".dot");

  if (dots.length === 2) {
    dots[0].classList.toggle("active", !statsVisible);
    dots[1].classList.toggle("active", statsVisible);
  }
}

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
// UI EVENT HANDLERS (Moved from orchestrator.js)
// ============================================================================

/**
 * Handle click on "Try Lite Version" button
 * @param {Object} deps - Dependencies containing showConfirmationModal
 */
export function handleTryLiteVersionClick(deps) {
  const showConfirmationModal = deps?.showConfirmationModal || getUiApi()?.showConfirmationModal;

  showConfirmationModal?.({
    title: "Switch to Lite Version",
    message: "Try the Lite version? It works great on older devices and slower connections.",
    confirmText: "Try Lite Version",
    cancelText: "Stay Here",
    callback: (confirmed) => {
      if (confirmed) {
        window.location.href = 'lite/miniCycle-lite.html';
      }
    }
  });
}

/**
 * Setup user manual link handler
 * @param {Object} GlobalUtils - GlobalUtils module reference
 */
export function setupUserManual(GlobalUtils) {
  const openUserManual = document.getElementById("open-user-manual");
  if (!openUserManual) return;

  GlobalUtils.safeAddEventListener(openUserManual, "click", () => {
    // Hide the menu when clicking
    try {
      getUiApi()?.hideMainMenu?.();
    } catch (e) {
      // Menu API not ready - ok
    }

    // Disable button briefly to prevent multiple clicks
    openUserManual.disabled = true;

    // Redirect to the User Manual page after a short delay
    setTimeout(() => {
      window.location.href = "legal/user-manual.html";
      openUserManual.disabled = false;
    }, 200);
  });
}

/**
 * Setup lite version button handler
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {Object} deps - Dependencies containing showConfirmationModal
 */
export function setupTryLiteVersionButton(GlobalUtils, deps) {
  GlobalUtils.safeAddEventListenerById('try-lite-version', 'click', () => handleTryLiteVersionClick(deps));
}

// ============================================================================
// FINALIZE UI
// ============================================================================

/**
 * Finalize UI setup after all modules are loaded
 * Called by orchestrator after bootFeatures completes
 * @param {Object} options - Configuration options
 */
export async function finalizeUI(options) {
  const {
    GlobalUtils,
    deps,
    getHandleCompleteAllTasks,
    getInitializeModeSelector,
    getUpdateMoveArrowsVisibility,
    getInitCompletedTasksSection,
    getRecurringPanel,
    getDeviceDetectionManager
  } = options;

  // Complete All button listener
  const completeAllButton = document.getElementById("completeAll");
  const handleCompleteAll = getHandleCompleteAllTasks?.();
  if (completeAllButton && typeof handleCompleteAll === 'function') {
    GlobalUtils.safeAddEventListener(completeAllButton, "click", handleCompleteAll);
  }

  // Final module setup
  getInitializeModeSelector?.()?.();
  getUpdateMoveArrowsVisibility?.()?.();
  getInitCompletedTasksSection?.()?.();
  getRecurringPanel?.()?.updateRecurringPanelButtonVisibility?.();

  // Device detection
  const deviceManager = getDeviceDetectionManager?.();
  if (deviceManager) {
    await deviceManager.autoRedetectOnVersionChange();
  }

  console.log('✅ UI finalized');
}

// ============================================================================
// MAIN ENTRYPOINT
// ============================================================================

/**
 * Initialize all UI setup in one call
 * This is the single entrypoint for orchestrator.js to call
 * @param {Object} options - Configuration options
 * @param {Object} options.GlobalUtils - GlobalUtils module reference
 * @param {Object} options.deps - Dependencies container
 * @param {Object} options.appContextMod - appContext module reference
 */
export async function initUIBoot({ GlobalUtils, deps, appContextMod }) {
  // Ensure appContext is loaded before using getters
  await loadAppContext();

  // Register isOverlayActive to deps
  deps.ui.isOverlayActive = isOverlayActive;

  // Nav dots and menu setup
  updateNavDots();
  setupUserManual(GlobalUtils);
  setupTryLiteVersionButton(GlobalUtils, { showConfirmationModal: deps.utils.showConfirmationModal });

  // Finalize UI (Complete All button, mode selector, device detection, etc.)
  await finalizeUI({
    GlobalUtils,
    deps,
    getHandleCompleteAllTasks: appContextMod.getHandleCompleteAllTasks,
    getInitializeModeSelector: appContextMod.getInitializeModeSelector,
    getUpdateMoveArrowsVisibility: appContextMod.getUpdateMoveArrowsVisibility,
    getInitCompletedTasksSection: appContextMod.getInitCompletedTasksSection,
    getRecurringPanel: appContextMod.getRecurringPanel,
    getDeviceDetectionManager: appContextMod.getDeviceDetectionManager
  });

  // DOM elements for listeners
  const taskInput = document.getElementById('taskInput');
  const addTaskButton = document.getElementById('addTaskBtn');
  const menuButton = document.querySelector('.menu-button');
  const menu = document.querySelector('.menu-container');

  // Attach event listeners
  attachTaskInputListeners(GlobalUtils, taskInput, addTaskButton, appContextMod);
  attachMenuButtonListener(GlobalUtils, menuButton, menu);
  attachGlobalEventListeners(GlobalUtils);

  // Hide loader and focus input
  hideAppLoader();
  requestAnimationFrame(() => taskInput?.focus());

  console.log('✅ UI boot complete');
}

// ============================================================================
// MODULE INFO
// ============================================================================

console.log('📱 uiBoot.js loaded (UI event handlers & helpers)');
