/**
 * miniCycle UI Boot Module
 *
 * Handles ALL UI setup via the initUIBoot() entrypoint. This is the THIRD
 * phase of the 3-phase boot sequence (core → feature → ui).
 *
 * Responsibilities:
 * - All global DOM event listeners (keyboard shortcuts, clicks)
 * - UI helper functions (loaders, overlays)
 * - Device detection fallback
 * - Task input and menu button listeners
 * - Loader hiding and input focus
 *
 * MAIN ENTRYPOINT:
 * - initUIBoot({ GlobalUtils, deps, appContextMod })
 *   Called by orchestrator.js after data load
 *
 * ARCHITECTURE:
 * - orchestrator.js is a pure sequence controller (no UI logic)
 * - uiBoot.js owns ALL UI setup via initUIBoot()
 * - Zero window.* globals - uses appContext grouped APIs
 *
 * IMPORT RULES:
 * - This file CAN import from coreBoot.js
 * - This file CAN import from featureBoot.js
 * - This file uses appContext.js getters for cross-module access
 *
 * @module boot/uiBoot
 * @version 2.0.0
 * @see {@link module:boot/coreBoot} - First phase (core initialization)
 * @see {@link module:boot/featureBoot} - Second phase (feature initialization)
 */

/**
 * @typedef {Object} UIBootOptions
 * @property {Object} GlobalUtils - GlobalUtils module reference
 * @property {Object} deps - Dependencies container with ui, utils, core
 * @property {Object} appContextMod - appContext module for grouped API access
 */

/**
 * @typedef {Object} FinalizeUIOptions
 * @property {Object} GlobalUtils - GlobalUtils module reference
 * @property {Object} deps - Dependencies container
 * @property {Function} getHandleCompleteAllTasks - Getter for complete all handler
 * @property {Function} getInitializeModeSelector - Getter for mode selector init
 * @property {Function} getUpdateMoveArrowsVisibility - Getter for move arrows update
 * @property {Function} getInitCompletedTasksSection - Getter for completed tasks init
 * @property {Function} getRecurringPanel - Getter for recurring panel
 * @property {Function} getDeviceDetectionManager - Getter for device detection
 */

// ============================================================================
// MODULE-LEVEL DEPS (set via initUIBoot from appContextMod)
// ============================================================================
// NOTE: No appContext fallback - all dependencies come through initUIBoot
// This avoids versioned/unversioned module instance mismatch issues

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

let _appContextMod = null;

// Getters that use the injected appContextMod (using grouped APIs)
const getAppState = () => _appContextMod?.state?.()?.AppState || null;
const getShowNotification = () => _appContextMod?.ui?.()?.showNotification || null;
const getStateApi = () => _appContextMod?.state?.() || null;
const getUndoApi = () => _appContextMod?.undo?.() || null;
const getUiApi = () => _appContextMod?.ui?.() || null;
const getCycleApi = () => _appContextMod?.cycle?.() || null;
const getReminderApi = () => _appContextMod?.reminder?.() || null;
const getDeviceDetectionManager = () => _appContextMod?.ui?.()?.deviceDetectionManager || null;
const getGetModal = () => _appContextMod?.ui?.()?.getModal || null;

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
        getShowNotification()?.('❌ Failed to add task. Please try again.', 'error', 3000);
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
          getShowNotification()?.('❌ Failed to add task. Please try again.', 'error', 3000);
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
      } catch (e) {
        // APIs may not be ready - that's ok
      }

      menu.classList.toggle('visible');

      if (menu.classList.contains('visible')) {
        menu._previousFocus = document.activeElement;
        // Focus first focusable element in menu
        const firstFocusable = menu.querySelector('button, [tabindex="0"]');
        if (firstFocusable) setTimeout(() => firstFocusable.focus({ focusVisible: false }), 50);
        // Escape key handler
        menu._escHandler = (e) => {
          if (e.key === 'Escape') {
            menu.classList.remove('visible');
            document.removeEventListener('keydown', menu._escHandler);
            document.removeEventListener('click', closeMenuOnClickOutside);
            menu._previousFocus?.focus({ focusVisible: false });
          }
        };
        document.addEventListener('keydown', menu._escHandler);
        safeAddEventListener(document, 'click', closeMenuOnClickOutside);
      } else {
        // Menu closing — clean up and restore focus
        if (menu._escHandler) {
          document.removeEventListener('keydown', menu._escHandler);
        }
        menu._previousFocus?.focus({ focusVisible: false });
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
  const isModalClick = event.target.closest('.modal, .mini-modal-dialog, .settings-modal, .notification');
  const isUndoRedoClick = event.target.closest('#undo-btn, #redo-btn, .undo-btn, .redo-btn');

  if (!isTaskOrOptionsClick && !isModalClick && !isUndoRedoClick) {
    console.log('✅ Clicking outside - closing task buttons');

    const threeDotsEnabled = document.body.classList.contains('show-three-dots-enabled');

    document.querySelectorAll(DOM_SELECTORS.TASK_OPTIONS).forEach(action => {
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

    document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
      task.classList.remove('long-pressed', 'draggable', 'dragging');

      // Keep selections in recurring panel
      const recurringPanel = getGetModal()?.('recurringOverlay');
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
  const switchModalContent = document.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
  const selectedCycle = document.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
  const switchItemsRow = document.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
  const previewWindow = document.querySelector(DOM_SELECTORS.SWITCH_PREVIEW_WINDOW);

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
    showNotification?.('❌ ' + getLabel('notify.positionResetFailed'), 'error', 2000);
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

    showNotification?.('🔄 ' + getLabel('notify.positionReset'), 'success', 2000);
  } catch (error) {
    console.error('❌ Failed to reset notification position:', error);
    showNotification?.('❌ ' + getLabel('notify.positionResetFailed'), 'error', 2000);
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

  const modal = getGetModal()?.('reminders');
  if (modal && !modal.open) {
    modal._previousFocus = document.activeElement;
    modal.showModal();
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
  const menu = document.querySelector(DOM_SELECTORS.MENU_CONTAINER);
  const menuButton = document.querySelector(DOM_SELECTORS.MENU_BUTTON);

  if (menu && !menu.contains(event.target) && !menuButton?.contains(event.target)) {
    menu.classList.remove('visible');
    document.removeEventListener('click', closeMenuOnClickOutside);
    if (menu._escHandler) {
      document.removeEventListener('keydown', menu._escHandler);
    }
    menu._previousFocus?.focus({ focusVisible: false });
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
  if (document.querySelector(DOM_SELECTORS.MENU_CONTAINER_VISIBLE)) return true;

  const overlaySelectors = [
    'dialog.settings-modal[open]',
    'dialog.mini-cycle-switch-modal[open]',
    'dialog#feedback-modal[open]',
    'dialog#about-modal[open]',
    'dialog#themes-modal[open]',
    'dialog#games-panel[open]',
    'dialog#reminders-modal[open]',
    '#testing-modal[style*="display: flex"]',
    'dialog#recurring-panel-overlay[open]',
    '.notification-container .notification',
    '#storage-viewer-overlay:not(.hidden)',
    'dialog.mini-modal-dialog[open]',
    'dialog.miniCycle-prompt-dialog[open]',
    '.onboarding-modal:not([style*="display: none"])'
  ];

  return overlaySelectors.some(selector => document.querySelector(selector));
}

/**
 * Update navigation dots for task/stats panel switching
 */
export function updateNavDots() {
  const statsPanel = document.getElementById(DOM_IDS.STATS_PANEL);
  const statsVisible = statsPanel && statsPanel.classList.contains("show");
  const dots = document.querySelectorAll(DOM_SELECTORS.DOT);

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
    // Remove app-loading class to reveal main content (prevents CLS during boot)
    document.body.classList.remove('app-loading');

    const appLoader = document.getElementById(DOM_IDS.APP_LOADER);
    if (appLoader) {
      appLoader.classList.add('fade-out');
      setTimeout(() => {
        appLoader.style.display = 'none';
        // Signal successful load via dataset (HTML checks this instead of window.*)
        document.documentElement.dataset.appLoaded = 'true';

        // Update iOS status bar color now that loading is complete
        // (starts black during load, switches to theme color after)
        _appContextMod?.getUiApi?.()?.updateThemeColor?.();
      }, 500);
    }
  }, 500);
}

/**
 * Show a loading spinner with message
 * @param {string} message - Loading message to display
 */
export function showLoader(message = 'Processing...') {
  const overlay = document.getElementById(DOM_IDS.LOADING_OVERLAY);
  const textElement = overlay?.querySelector(DOM_SELECTORS.LOADING_SPINNER_TEXT);

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
  const overlay = document.getElementById(DOM_IDS.LOADING_OVERLAY);
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
  const openUserManual = document.getElementById(DOM_IDS.OPEN_USER_MANUAL);
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
  GlobalUtils.safeAddEventListenerById('menu-lite-version', 'click', () => handleTryLiteVersionClick(deps));
}

// ============================================================================
// FINALIZE UI
// ============================================================================

/**
 * Finalize UI setup after all modules are loaded.
 * Called by initUIBoot after basic listeners are attached.
 *
 * Initializes:
 * - Complete All button click handler
 * - Mode selector
 * - Move arrows visibility
 * - Completed tasks section
 * - Recurring panel button visibility
 * - Device detection auto-redetect
 *
 * @param {FinalizeUIOptions} options - Configuration options
 * @returns {Promise<void>}
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
  const completeAllButton = document.getElementById(DOM_IDS.COMPLETE_ALL);
  const handleCompleteAll = getHandleCompleteAllTasks?.();
  if (completeAllButton && typeof handleCompleteAll === 'function') {
    GlobalUtils.safeAddEventListener(completeAllButton, "click", handleCompleteAll);
  }

  // Final module setup — validate getters resolve before calling
  const initModeSelector = getInitializeModeSelector?.();
  const updateArrows = getUpdateMoveArrowsVisibility?.();
  const initCompleted = getInitCompletedTasksSection?.();
  const recurringPanel = getRecurringPanel?.();

  if (typeof initModeSelector === 'function') initModeSelector();
  else console.warn('⚠️ finalizeUI: initializeModeSelector not available');

  if (typeof updateArrows === 'function') updateArrows();
  else console.warn('⚠️ finalizeUI: updateMoveArrowsVisibility not available');

  if (typeof initCompleted === 'function') initCompleted();
  else console.warn('⚠️ finalizeUI: initCompletedTasksSection not available');

  recurringPanel?.updateRecurringPanelButtonVisibility?.();

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
 * Initialize all UI setup in one call.
 * This is the single entrypoint for orchestrator.js to call after data loads.
 *
 * Sets up:
 * - Task input and menu button listeners
 * - Global event listeners (keyboard shortcuts, clicks)
 * - Complete All button handler
 * - Mode selector, move arrows, completed tasks section
 * - Device detection and app loader hiding
 *
 * @param {UIBootOptions} options - Configuration options
 * @returns {Promise<void>}
 * @example
 * await initUIBoot({
 *     GlobalUtils: deps.utils.GlobalUtils,
 *     deps: deps,
 *     appContextMod: await import('../core/appContext.js')
 * });
 */
export async function initUIBoot({ GlobalUtils, deps, appContextMod }) {
  // Store appContextMod for use by module-level getters
  _appContextMod = appContextMod;

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
    getHandleCompleteAllTasks: () => appContextMod.getTaskApi?.()?.handleCompleteAll,
    getInitializeModeSelector: () => appContextMod.getCycleApi?.()?.initializeModeSelector,
    getUpdateMoveArrowsVisibility: () => appContextMod.getTaskApi?.()?.updateMoveArrows,
    getInitCompletedTasksSection: () => appContextMod.getUiApi?.()?.initCompletedTasksSection,
    getRecurringPanel: () => appContextMod.getRecurringApi?.()?.panel,
    getDeviceDetectionManager: () => appContextMod.getUiApi?.()?.deviceDetectionManager
  });

  // DOM elements for listeners
  const taskInput = document.getElementById(DOM_IDS.TASK_INPUT);
  const addTaskButton = document.getElementById(DOM_IDS.ADD_TASK_BTN);
  const menuButton = document.querySelector(DOM_SELECTORS.MENU_BUTTON);
  const menu = document.querySelector(DOM_SELECTORS.MENU_CONTAINER);

  // Attach event listeners
  attachTaskInputListeners(GlobalUtils, taskInput, addTaskButton, appContextMod);
  attachMenuButtonListener(GlobalUtils, menuButton, menu);
  attachGlobalEventListeners(GlobalUtils);

  // Hide loader and focus input
  hideAppLoader();
  requestAnimationFrame(() => taskInput?.focus({ focusVisible: false }));

  console.log('✅ UI boot complete');

  // ========== SESSION BACKUP (non-blocking) ==========
  // Create a session backup on every app open (keeps last 5)
  // This runs after UI is fully loaded to avoid blocking boot
  setTimeout(async () => {
    try {
      if (deps.storage?.backupManager?.createSessionBackup) {
        await deps.storage.backupManager.createSessionBackup();
      }
    } catch (error) {
      console.warn('⚠️ Session backup failed (non-critical):', error);
    }
  }, 1000); // Delay 1s to ensure AppState is fully ready
}

// ============================================================================
// MODULE INFO
// ============================================================================

console.log('📱 uiBoot.js loaded (UI event handlers & helpers)');
