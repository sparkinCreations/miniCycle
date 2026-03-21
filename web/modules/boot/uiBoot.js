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

import { DOM_IDS, DOM_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

let _appContextMod = null;

// Getters that use the injected appContextMod (using grouped APIs)
const getAppState = () => _appContextMod?.state?.()?.AppState || null;
const getShowNotification = () => _appContextMod?.ui?.()?.showNotification || null;
const getStateApi = () => _appContextMod?.state?.() || null;
const getUndoApi = () => _appContextMod?.undo?.() || null;
const getUiApi = () => _appContextMod?.ui?.() || null;
const getDeviceDetectionManager = () => _appContextMod?.ui?.()?.deviceDetectionManager || null;
const getGetModal = () => _appContextMod?.ui?.()?.getModal || null;

/**
 * Replace a persistent listener on a live element/document across in-page boot retries.
 * Versioned re-imports create fresh function identities, so safeAddEventListener()
 * alone cannot remove the prior boot attempt's handler.
 *
 * @param {EventTarget|null} element
 * @param {string} event
 * @param {string} key
 * @param {Function} handler
 * @param {Object} [options]
 */
function replaceStoredEventListener(element, event, key, handler, options) {
  if (!element) return;

  if (typeof element[key] === 'function') {
    element.removeEventListener(event, element[key], options);
  }

  element[key] = handler;
  element.addEventListener(event, handler, options);
}

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

/**
 * Attach all global event listeners
 * Called from orchestrator.js after modules are loaded
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {Object} options - Configuration options
 */
export function attachGlobalEventListeners(_GlobalUtils, _options = {}) {
  // ========== Keyboard Shortcuts ==========
  replaceStoredEventListener(
    document,
    'keydown',
    '__miniCycleUiBootGlobalKeydownHandler',
    handleGlobalKeydown
  );

  // ========== Global Click: Hide Task Buttons ==========
  replaceStoredEventListener(
    document,
    'click',
    '__miniCycleUiBootTaskButtonsClickHandler',
    handleGlobalClickForTaskButtons
  );

  // ========== Global Click: Deselect in Switch Modal ==========
  replaceStoredEventListener(
    document,
    'click',
    '__miniCycleUiBootSwitchModalClickHandler',
    handleGlobalClickForSwitchModal
  );

  // ========== Reset Notification Position ==========
  replaceStoredEventListener(
    document.getElementById('reset-notification-position'),
    'click',
    '__miniCycleUiBootResetNotificationClickHandler',
    handleResetNotificationPosition
  );

  // ========== First Touch Interaction ==========
  replaceStoredEventListener(
    document,
    'touchstart',
    '__miniCycleUiBootFirstTouchHandler',
    handleFirstTouchInteraction,
    { once: true, passive: true }
  );

  // ========== Passive Touchstart (for scroll performance) ==========
  replaceStoredEventListener(
    document,
    'touchstart',
    '__miniCycleUiBootPassiveTouchstartHandler',
    handlePassiveTouchstart,
    { passive: true }
  );

}

/**
 * Attach task input event listeners
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {HTMLElement} taskInput - Task input element
 * @param {HTMLElement} addTaskButton - Add task button element
 * @param {Object} appContextMod - appContext module (versioned import)
 */
export function attachTaskInputListeners(_GlobalUtils, taskInput, addTaskButton, appContextMod) {
  // Add Task Button (Click)
  if (addTaskButton) {
    replaceStoredEventListener(addTaskButton, 'click', '__miniCycleUiBootAddTaskClickHandler', () => {
      // Enable undo system on first user interaction
      try {
        appContextMod?.getUndoApi?.()?.enableOnFirstInteraction?.();
      } catch {
        // API not ready yet - ok during early boot
      }

      const taskText = taskInput?.value?.trim() || '';
      if (!taskText) {
        console.warn('⚠ Cannot add an empty task.');
        return;
      }

      try {
        const taskApi = appContextMod.getTaskApi();
        taskApi?.add?.(taskText);
      } catch (e) {
        console.error('❌ Failed to add task:', e);
        getShowNotification()?.('❌ ' + getLabel('notify.taskAddFailed'), 'error', 3000);
      }
      taskInput.value = '';
    });
  } else {
    console.warn('⚠️ addTaskButton element not found!');
  }

  // Task Input (Enter Key)
  if (taskInput) {
    replaceStoredEventListener(taskInput, 'keypress', '__miniCycleUiBootTaskInputKeypressHandler', (event) => {
      if (event.key === 'Enter') {
        // Enable undo system on first user interaction
        try {
          appContextMod?.getUndoApi?.()?.enableOnFirstInteraction?.();
        } catch {
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
          getShowNotification()?.('❌ ' + getLabel('notify.taskAddFailed'), 'error', 3000);
        }
        taskInput.value = '';
      }
    });
  }

}

/**
 * Attach menu button event listener
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {HTMLElement} menuButton - Menu button element
 * @param {HTMLElement} menu - Menu container element
 */
export function attachMenuButtonListener(_GlobalUtils, menuButton, menu) {
  if (menuButton && menu) {
    replaceStoredEventListener(menuButton, 'click', '__miniCycleUiBootMenuButtonClickHandler', (event) => {
      event.stopPropagation();

      // Sync settings before showing menu
      try {
        getUiApi()?.syncCurrentSettingsToStorage?.();
      } catch {
        // APIs may not be ready - that's ok
      }

      menu.classList.toggle('visible');
      const isVisible = menu.classList.contains('visible');
      menuButton.setAttribute('aria-expanded', String(isVisible));

      if (isVisible) {
        menu._previousFocus = document.activeElement;
        // Focus first focusable element in menu
        const firstFocusable = menu.querySelector('button, [tabindex="0"]');
        if (firstFocusable) setTimeout(() => firstFocusable.focus({ focusVisible: false }), 50);

        // Show menu guided tour prompt (first open only)
        getUiApi()?.showMenuTourNotification?.();
        // Escape key handler
        menu._escHandler = (e) => {
          if (e.key === 'Escape') {
            menu.classList.remove('visible');
            menuButton.setAttribute('aria-expanded', 'false');
            document.removeEventListener('keydown', menu._escHandler);
            document.removeEventListener('click', closeMenuOnClickOutside);
            menu._previousFocus?.focus({ focusVisible: false });
          }
        };
        document.addEventListener('keydown', menu._escHandler);
        replaceStoredEventListener(
          document,
          'click',
          '__miniCycleUiBootMenuCloseOutsideHandler',
          closeMenuOnClickOutside
        );
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
 * Global click handler — "light dismiss" for task UI states.
 * Clicking empty background clears lingering hover, drag, selection,
 * and task option button states. Excludes modals, menus, and panels.
 */
function handleGlobalClickForTaskButtons(event) {
  const target = event.target;

  // Ignore clicks on interactive surfaces that shouldn't trigger a dismiss
  const isIgnored =
    target.closest('.task, .task-options') ||
    target.closest('[data-modal], dialog, .notification') ||
    target.closest('#undo-btn, #redo-btn, .undo-btn, .redo-btn') ||
    target.closest('.menu-container, .quick-actions-window, .help-window');

  if (isIgnored) return;

  const threeDotsEnabled = document.body.classList.contains('show-three-dots-enabled');

  // Reset task option button visibility using CSS classes (not inline styles)
  document.querySelectorAll(DOM_SELECTORS.TASK_OPTIONS).forEach(action => {
    action.classList.remove('task-options-visible');
    if (threeDotsEnabled) {
      action.classList.add('task-options-force-hidden');
    }
    // Clear any lingering inline styles from legacy code paths
    action.style.opacity = '';
    action.style.visibility = '';
    action.style.pointerEvents = '';
  });

  // Hoist recurring panel check outside the loop
  const recurringPanel = getGetModal()?.('recurringOverlay');
  const recurringPanelOpen = recurringPanel && !recurringPanel.classList.contains('hidden');

  document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
    task.classList.remove('long-pressed', 'draggable', 'dragging');

    // Keep selections while recurring panel is open
    if (!recurringPanelOpen) {
      task.classList.remove('selected');
    }
  });
}

/**
 * Global click handler for deselecting in switch modal
 */
function handleGlobalClickForSwitchModal(event) {
  const switchModalContent = document.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
  const selectedCycle = document.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
  const switchItemsRow = document.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
  const previewWindow = document.querySelector(DOM_SELECTORS.SWITCH_PREVIEW_WINDOW);

  const themePicker = document.getElementById(DOM_IDS.THEME_PICKER_ROW);

  if (
    switchModalContent?.contains(event.target) &&
    selectedCycle &&
    !event.target.classList.contains('mini-cycle-switch-item') &&
    !event.target.closest('.mini-cycle-switch-item') &&
    !previewWindow?.contains(event.target) &&
    !event.target.closest('.switch-buttons') &&
    !themePicker?.contains(event.target)
  ) {
    selectedCycle.classList.remove('selected');
    if (switchItemsRow) {
      switchItemsRow.style.display = 'none';
    }
    if (themePicker) {
      themePicker.classList.add('hidden');
    }
    if (previewWindow) {
      previewWindow.innerHTML = '<p style="color: #888; font-style: italic;">' + getLabel('switcher.selectPreview') + '</p>';
    }
  }
}

/**
 * Handle reset notification position click
 */
async function handleResetNotificationPosition() {

  // Use appContext getters
  const AppState = getAppState();
  const showNotification = getShowNotification();

  if (!AppState?.isReady?.()) {
    console.error('❌ AppState not ready for reset notification position');
    showNotification?.('❌ ' + getLabel('notify.positionResetFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
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

    // Use grouped API
    try {
      getUiApi()?.resetNotificationPosition?.();
    } catch (e) {
      console.warn('⚠️ Could not reset notification position UI:', e);
    }

    showNotification?.('🔄 ' + getLabel('notify.positionReset'), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
  } catch (error) {
    console.error('❌ Failed to reset notification position:', error);
    showNotification?.('❌ ' + getLabel('notify.positionResetFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
  }
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
  } catch {
    // stateApi not registered yet - fallback silently
    console.warn('⚠️ First touch before stateApi ready');
  }
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
    menuButton?.setAttribute('aria-expanded', 'false');
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
  // Catch-all for any open dialog (covers dynamically created dialogs like #badge-detail-overlay)
  if (document.querySelector('dialog[open]')) return true;
  if (document.querySelector(DOM_SELECTORS.MENU_CONTAINER_VISIBLE)) return true;

  const overlaySelectors = [
    '#testing-modal[style*="display: flex"]',
    '.notification-container .notification',
    '#storage-viewer-overlay:not(.hidden)',
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
 * Show the app splash screen with a custom message.
 * Re-uses #app-loader (the boot splash with logo + progress bar) for a
 * consistent branded experience during import/restore operations.
 * @param {string} message - Loading message to display (e.g. 'Loading routines...')
 */
export function showLoader(message = 'Processing...') {
  const appLoader = document.getElementById(DOM_IDS.APP_LOADER);
  if (!appLoader) return;

  // Hide the tip section (not relevant during import/restore)
  const tip = appLoader.querySelector('#loader-tip');
  if (tip) tip.style.display = 'none';

  // Update the text
  const textElement = appLoader.querySelector(DOM_SELECTORS.LOADER_TEXT);
  if (textElement && message) {
    textElement.textContent = message;
  }

  // Show the splash screen
  appLoader.classList.remove('fade-out');
  appLoader.style.display = '';
  appLoader.setAttribute('aria-busy', 'true');
}

/**
 * Hide the app splash screen after an operation completes.
 * Restores original text for the next boot.
 */
export function hideLoader() {
  const appLoader = document.getElementById(DOM_IDS.APP_LOADER);
  if (!appLoader) return;

  appLoader.classList.add('fade-out');
  appLoader.setAttribute('aria-busy', 'false');
  setTimeout(() => {
    appLoader.style.display = 'none';

    // Restore original text and tip visibility for next boot
    const textElement = appLoader.querySelector(DOM_SELECTORS.LOADER_TEXT);
    if (textElement) textElement.textContent = getLabel('boot.loadingApp');
    const tip = appLoader.querySelector('#loader-tip');
    if (tip) tip.style.display = '';
  }, 500);
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
  } catch {
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

  try {
    getUiApi()?.hideMainMenu?.();
  } catch {
    // Menu API not ready - ok
  }

  showConfirmationModal?.({
    title: getLabel('modal.liteVersionTitle'),
    message: getLabel('modal.liteVersionMessage'),
    confirmText: getLabel('modal.liteVersionConfirm'),
    cancelText: getLabel('modal.liteVersionCancel'),
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
export function setupUserManual(_GlobalUtils) {
  const openUserManual = document.getElementById(DOM_IDS.OPEN_USER_MANUAL);
  if (!openUserManual) return;

  replaceStoredEventListener(openUserManual, 'click', '__miniCycleUiBootOpenManualClickHandler', () => {
    // Hide the menu when clicking
    try {
      getUiApi()?.hideMainMenu?.();
    } catch {
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
 * Setup menu "Reset Tours" button handler (Help & Support section)
 */
export function setupMenuRetakeTours() {
  const btn = document.getElementById(DOM_IDS.MENU_RETAKE_TOURS);
  if (!btn) return;

  replaceStoredEventListener(btn, 'click', '__miniCycleMenuRetakeToursClickHandler', async () => {
    const AppState = getAppState();
    if (!AppState?.isReady?.()) return;

    // Reset ALL tour progress
    await AppState.update((state) => {
      if (!state.settings) state.settings = {};
      state.settings.guidedTourStep = null;
      state.settings.statsTourStep = null;
      state.settings.prefsTourStep = null;
      state.settings.taskOptionsTourStep = null;
      state.settings.remindersTourStep = null;
      state.settings.menuTourStep = null;
      state.settings.settingsTourStep = null;
      state.settings.routineSwitcherTourStep = null;
      state.settings.recurringListTourStep = null;
      state.settings.recurringSettingsTourStep = null;
      state.settings.historyTourStep = null;
      state.settings.clearedTasksTourStep = null;
      state.settings.achievementsTourStep = null;
      // Reset Quick Actions view tips
      state.settings.quickActionsTipPinned = false;
      state.settings.quickActionsTipRecent = false;
      state.settings.quickActionsTipFrequent = false;
    }, true);

    // Hide menu
    try {
      getUiApi()?.hideMainMenu?.();
    } catch {
      // Menu API not ready
    }

    // Ask user if they want to start the tour
    const showNotification = getShowNotification();
    showNotification?.(
      getLabel('tour.toursReset'),
      'info',
      null,
      {
        actionButton: {
          label: getLabel('tour.startTourAction'),
          onClick: () => getUiApi()?.startGuidedTour?.()
        }
      }
    );
  });
}

/**
 * Setup lite version button handler
 * @param {Object} GlobalUtils - GlobalUtils module reference
 * @param {Object} deps - Dependencies containing showConfirmationModal
 */
export function setupTryLiteVersionButton(_GlobalUtils, deps) {
  replaceStoredEventListener(
    document.getElementById('try-lite-version'),
    'click',
    '__miniCycleUiBootTryLiteClickHandler',
    () => handleTryLiteVersionClick(deps)
  );
  replaceStoredEventListener(
    document.getElementById('menu-lite-version'),
    'click',
    '__miniCycleUiBootTryLiteClickHandler',
    () => handleTryLiteVersionClick(deps)
  );
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
  if (completeAllButton) {
    replaceStoredEventListener(
      completeAllButton,
      'click',
      '__miniCycleUiBootCompleteAllClickHandler',
      () => getHandleCompleteAllTasks?.()?.()
    );
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

  // Sync theme-sensitive labels with the active vocab theme.
  // Several DOM elements (e.g. #toggle-task-input-text) are hardcoded in HTML
  // and only get their themed text ("Add habit", "Complete Habits", etc.) via JS.
  // This call must come AFTER initializeModeSelector() because that function is
  // async and resumes after waitForCore(), potentially overwriting labels set
  // earlier. By running last in finalizeUI(), we guarantee the themed values win.
  deps.features?.themeManager?.refreshThemeLabels?.();

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

  // Register UI helpers to deps for DI access by other modules
  deps.ui.isOverlayActive = isOverlayActive;
  deps.ui.showLoader = showLoader;
  deps.ui.hideLoader = hideLoader;

  // Nav dots and menu setup
  updateNavDots();
  setupUserManual(GlobalUtils);
  setupMenuRetakeTours();
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
