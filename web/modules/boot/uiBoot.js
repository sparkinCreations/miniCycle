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

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { initNativeShell, isNativeApp } from '../platform/capacitorBridge.js';
import { goToLiteVersion } from '../utils/liteVersion.js';
import { featureAvailability } from '../utils/featureAvailability.js';
import { initHeaderLayout } from '../ui/headerLayoutManager.js';

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

/**
 * Remove a listener previously attached via replaceStoredEventListener.
 * Retry-safe: removes by the reference stored on the element, so the newest
 * boot can detach a prior boot's differently-versioned handler.
 *
 * @param {EventTarget|null} element
 * @param {string} event
 * @param {string} key
 * @param {Object} [options]
 */
function removeStoredEventListener(element, event, key, options) {
  if (element && typeof element[key] === 'function') {
    element.removeEventListener(event, element[key], options);
    element[key] = null;
  }
}

// Stored-listener keys for the main-menu document handlers. Keyed attach/detach
// (not plain add/removeEventListener) keeps them retry-safe AND, because the
// handlers are stable module references, guarantees at most one of each is ever
// attached — reopening replaces instead of stacking (July 2026 boot audit, M3).
const MENU_ESC_KEY = '__miniCycleUiBootMenuEscHandler';
const MENU_OUTSIDE_KEY = '__miniCycleUiBootMenuCloseOutsideHandler';

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

  // ========== Reset Notification Position ==========
  replaceStoredEventListener(
    document.getElementById(DOM_IDS.RESET_NOTIFICATION_POSITION),
    'click',
    '__miniCycleUiBootResetNotificationClickHandler',
    handleResetNotificationPosition
  );

  // ========== Reset Task View Layout ==========
  replaceStoredEventListener(
    document.getElementById(DOM_IDS.RESET_TASK_VIEW_LAYOUT),
    'click',
    '__miniCycleUiBootResetTaskViewLayoutClickHandler',
    handleResetTaskViewLayoutClick
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
  // Dismiss first-time shimmer on the + button when user adds a task
  function dismissFirstTimeShimmer() {
    const quickActionsBtn = document.getElementById(DOM_IDS.QUICK_ACTIONS_BTN);
    if (quickActionsBtn?.classList.contains(DOM_CLASSES.FIRST_TIME_SHIMMER)) {
      quickActionsBtn.classList.remove(DOM_CLASSES.FIRST_TIME_SHIMMER);
      try {
        const AppState = appContextMod?.getStateApi?.()?.AppState;
        AppState?.update?.(state => {
          if (!state.settings) state.settings = {};
          state.settings.addTaskDiscovered = true;
        }, true);
      } catch {
        // State API not ready — shimmer class still removed from DOM
      }
    }
  }

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
        dismissFirstTimeShimmer();
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
          dismissFirstTimeShimmer();
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

      menu.classList.toggle(DOM_CLASSES.VISIBLE);
      const isVisible = menu.classList.contains(DOM_CLASSES.VISIBLE);
      menuButton.setAttribute('aria-expanded', String(isVisible));
      // Mirror menu visibility on body so CSS (backdrop blur, button
      // elevation) can drive off body class — PWA-reliable alternative to
      // :has() per existing project convention (see mode-selector.css).
      document.body.classList.toggle(DOM_CLASSES.MAIN_MENU_OPEN, isVisible);

      if (isVisible) {
        menu._previousFocus = document.activeElement;
        // Focus first focusable element in menu
        const firstFocusable = menu.querySelector('button, [tabindex="0"]');
        if (firstFocusable) setTimeout(() => firstFocusable.focus({ focusVisible: false }), UI_TIMEOUTS.FOCUS_DELAY_SHORT);

        // Show menu guided tour prompt (first open only)
        getUiApi()?.showMenuTourNotification?.();

        // Trap Tab focus within the menu while open. Unlike the app's <dialog>
        // modals (which get native top-layer focus trapping via .showModal()),
        // this <nav> overlay does not — so Tab would otherwise walk into the
        // content behind it. Wrap Tab/Shift+Tab at the menu's focusable edges.
        if (menu._trapHandler) menu.removeEventListener('keydown', menu._trapHandler);
        menu._trapHandler = (e) => {
          if (e.key !== 'Tab') return;
          const focusable = [...menu.querySelectorAll(DOM_SELECTORS.FOCUSABLE_ELEMENTS)]
            .filter(el => el.offsetParent !== null && !el.disabled);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || !menu.contains(active))) {
            e.preventDefault();
            last.focus({ focusVisible: false });
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus({ focusVisible: false });
          }
        };
        menu.addEventListener('keydown', menu._trapHandler);

        // Escape + click-outside attached via stored keys. Both handlers are
        // stable module references, so replaceStoredEventListener REPLACES the
        // prior boot/open's listener rather than orphaning a fresh closure —
        // fixing the leak where every open/hideMainMenu cycle stacked another
        // document keydown handler that fired on subsequent Escapes.
        replaceStoredEventListener(document, 'keydown', MENU_ESC_KEY, menuEscHandler);
        replaceStoredEventListener(document, 'click', MENU_OUTSIDE_KEY, closeMenuOnClickOutside);
      } else {
        // Toggle-close — detach all document listeners + trap, restore focus.
        closeMainMenu(menu, menuButton, { restoreFocus: true });
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
  // NOTE: with Shift held the browser reports the key as uppercase 'Z', so the
  // Shift+Z branch must compare against 'Z' (comparing to 'z' never matches).
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
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
    target.closest(`${DOM_SELECTORS.TASK}, ${DOM_SELECTORS.TASK_OPTIONS}`) ||
    target.closest(`${DOM_SELECTORS.DATA_MODAL}, dialog, ${DOM_SELECTORS.NOTIFICATION}`) ||
    target.closest(`#${DOM_IDS.UNDO_BTN}, #${DOM_IDS.REDO_BTN}, .undo-btn, .redo-btn`) ||
    target.closest(`${DOM_SELECTORS.MENU_CONTAINER}, #${DOM_IDS.QUICK_ACTIONS_WINDOW}, #${DOM_IDS.HELP_WINDOW}`);

  if (isIgnored) return;

  const threeDotsEnabled = document.body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);

  // Reset task option button visibility using CSS classes (not inline styles)
  document.querySelectorAll(DOM_SELECTORS.TASK_OPTIONS).forEach(action => {
    action.classList.remove(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
    if (threeDotsEnabled) {
      action.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
    }
    // Clear any lingering inline styles from legacy code paths
    action.style.opacity = '';
    action.style.visibility = '';
    action.style.pointerEvents = '';
  });

  // Hoist recurring panel check outside the loop
  const recurringPanel = getGetModal()?.('recurringOverlay');
  const recurringPanelOpen = recurringPanel && !recurringPanel.classList.contains(DOM_CLASSES.HIDDEN);

  document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
    task.classList.remove(DOM_CLASSES.LONG_PRESSED, DOM_CLASSES.DRAGGABLE, DOM_CLASSES.DRAGGING);

    // Keep selections while recurring panel is open
    if (!recurringPanelOpen) {
      task.classList.remove(DOM_CLASSES.SELECTED);
    }
  });
}

// Note: Switch modal deselection was previously handled here as a fallback.
// Removed in refactor (Apr 2026) — routineSwitcher.setupModalClickOutside()
// owns all deselection logic via _deselectRoutine().

/**
 * Handle reset task view layout click — confirms with the user, then
 * clears every saved position so all elements snap back to defaults.
 */
function handleResetTaskViewLayoutClick() {
  const showNotification = getShowNotification();
  const showConfirmationModal = getUiApi()?.showConfirmationModal;
  const resetTaskViewLayout = getUiApi()?.resetTaskViewLayout;

  if (typeof resetTaskViewLayout !== 'function') {
    console.warn('⚠️ resetTaskViewLayout not available');
    return;
  }

  const doReset = () => {
    try {
      const ok = resetTaskViewLayout();
      if (ok) {
        showNotification?.('🔄 ' + getLabel('notify.taskViewLayoutReset'), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
      } else {
        showNotification?.('❌ ' + getLabel('notify.taskViewLayoutResetFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
      }
    } catch (err) {
      console.error('❌ Failed to reset task view layout:', err);
      showNotification?.('❌ ' + getLabel('notify.taskViewLayoutResetFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }
  };

  if (typeof showConfirmationModal === 'function') {
    showConfirmationModal({
      title: getLabel('modal.resetTaskViewLayoutTitle'),
      message: getLabel('modal.resetTaskViewLayoutMessage'),
      confirmText: getLabel('modal.resetTaskViewLayoutConfirm'),
      callback: (confirmed) => {
        if (confirmed) doReset();
      }
    });
  } else {
    // Confirmation modal not available — proceed without confirmation.
    doReset();
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
 * Detach the main menu's document-level Escape + click-outside handlers and
 * its Tab-trap. Idempotent and retry-safe (removes via the stored keys).
 * @param {HTMLElement|null} menu
 */
function teardownMenuListeners(menu) {
  removeStoredEventListener(document, 'keydown', MENU_ESC_KEY);
  removeStoredEventListener(document, 'click', MENU_OUTSIDE_KEY);
  if (menu?._trapHandler) {
    menu.removeEventListener('keydown', menu._trapHandler);
    menu._trapHandler = null;
  }
}

/**
 * Close the main menu: strip visible state, detach every menu listener, and
 * (optionally) restore focus to whatever was focused before it opened.
 * The single close path for Escape, outside-click, and toggle-close so no
 * caller can leave a partial set of listeners attached.
 * @param {HTMLElement} menu
 * @param {HTMLElement|null} menuButton
 * @param {{restoreFocus?: boolean}} [opts]
 */
function closeMainMenu(menu, menuButton, { restoreFocus = false } = {}) {
  menu.classList.remove(DOM_CLASSES.VISIBLE);
  document.body.classList.remove(DOM_CLASSES.MAIN_MENU_OPEN);
  menuButton?.setAttribute('aria-expanded', 'false');
  teardownMenuListeners(menu);
  if (restoreFocus) menu._previousFocus?.focus({ focusVisible: false });
}

/**
 * Document keydown handler — Escape closes the menu. Stable module-level
 * reference (attached via MENU_ESC_KEY) so reopening never orphans a per-open
 * closure.
 */
function menuEscHandler(event) {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector(DOM_SELECTORS.MENU_CONTAINER);
  if (!menu) return;
  const menuButton = document.querySelector(DOM_SELECTORS.MENU_BUTTON);
  // Self-healing: if the menu was already closed by another path
  // (menuManager.hideMainMenu strips only the visible class, leaving this
  // handler attached), detach quietly — never steal focus from whatever the
  // user is interacting with now.
  if (!menu.classList.contains(DOM_CLASSES.VISIBLE)) { teardownMenuListeners(menu); return; }
  closeMainMenu(menu, menuButton, { restoreFocus: true });
}

/**
 * Document click handler — closes the menu when clicking outside it.
 */
function closeMenuOnClickOutside(event) {
  const menu = document.querySelector(DOM_SELECTORS.MENU_CONTAINER);
  if (!menu) return;
  const menuButton = document.querySelector(DOM_SELECTORS.MENU_BUTTON);
  // Self-healing guard (see menuEscHandler): the menu may have been closed by a
  // menu-item click via hideMainMenu, leaving this handler attached. Detach
  // without touching focus instead of yanking it back mid-interaction.
  if (!menu.classList.contains(DOM_CLASSES.VISIBLE)) { teardownMenuListeners(menu); return; }
  if (!menu.contains(event.target) && !menuButton?.contains(event.target)) {
    closeMainMenu(menu, menuButton, { restoreFocus: true });
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

  // NOTE: do NOT include `.notification-container .notification` here. Toast
  // notifications auto-dismiss in 2-8s and are popovers (not modal blockers) —
  // including them would block swipe gestures every time a toast is visible.
  // The separate `isDraggingNotification` check handles the case where the
  // user is actively dragging a notification.
  //
  // Migrated to <dialog> — the `dialog[open]` check above handles them correctly:
  //  - `#storage-viewer-overlay` (was a div with .hidden toggling)
  //  - `#testing-modal` (was opened via inline `style.display = 'flex'`)
  // Don't re-add their old detection patterns here; they'd over-match because
  // the elements always exist in the DOM regardless of open state.
  const overlaySelectors = [
    '.onboarding-modal:not([style*="display: none"])'
  ];

  return overlaySelectors.some(selector => document.querySelector(selector));
}

/**
 * Update navigation dots for task/stats panel switching
 */
export function updateNavDots() {
  const statsPanel = document.getElementById(DOM_IDS.STATS_PANEL);
  const statsVisible = statsPanel && statsPanel.classList.contains(DOM_CLASSES.SHOW);
  const dots = document.querySelectorAll(DOM_SELECTORS.DOT);

  if (dots.length === 2) {
    dots[0].classList.toggle(DOM_CLASSES.ACTIVE, !statsVisible);
    dots[1].classList.toggle(DOM_CLASSES.ACTIVE, statsVisible);
  }
}

/**
 * Hide the app loader/splash screen
 */
export function hideAppLoader() {
  setTimeout(() => {
    const appLoader = document.getElementById(DOM_IDS.APP_LOADER);

    // First-run choice screen: boot is done but the user hasn't picked yet.
    // Mark the app loaded NOW (so the HTML 60s lite failsafe can't fire while
    // they read the buttons) and defer the actual hide until the inline
    // controller dispatches 'firstrun:choice'. See FIRST_RUN_CHOICE_SCREEN_PLAN.md.
    if (appLoader?.getAttribute('data-awaiting-choice') === 'true') {
      document.documentElement.dataset.appLoaded = 'true';
      document.addEventListener('firstrun:choice', () => dismissAppLoader(appLoader), { once: true });
      return;
    }

    dismissAppLoader(appLoader);
  }, 500);
}

/**
 * Actually fade out and remove the splash (shared by the normal boot path and
 * the deferred first-run-choice path).
 * @param {HTMLElement|null} appLoader
 */
function dismissAppLoader(appLoader) {
  // Remove app-loading class to reveal main content (prevents CLS during boot)
  document.body.classList.remove(DOM_CLASSES.APP_LOADING);

  if (appLoader) {
    appLoader.classList.add(DOM_CLASSES.FADE_OUT);
    setTimeout(() => {
      appLoader.style.display = 'none';
      // Signal successful load via dataset (HTML checks this instead of window.*)
      document.documentElement.dataset.appLoaded = 'true';

      // Update iOS status bar color now that loading is complete
      // (starts black during load, switches to theme color after)
      _appContextMod?.getUiApi?.()?.updateThemeColor?.();
    }, 500);
  }
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
  const tip = appLoader.querySelector(`#${DOM_IDS.LOADER_TIP}`);
  if (tip) tip.style.display = 'none';

  // Update the text
  const textElement = appLoader.querySelector(DOM_SELECTORS.LOADER_TEXT);
  if (textElement && message) {
    textElement.textContent = message;
  }

  // Show the splash screen
  appLoader.classList.remove(DOM_CLASSES.FADE_OUT);
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

  appLoader.classList.add(DOM_CLASSES.FADE_OUT);
  appLoader.setAttribute('aria-busy', 'false');
  setTimeout(() => {
    appLoader.style.display = 'none';

    // Restore original text and tip visibility for next boot
    const textElement = appLoader.querySelector(DOM_SELECTORS.LOADER_TEXT);
    if (textElement) textElement.textContent = getLabel('boot.loadingApp');
    const tip = appLoader.querySelector(`#${DOM_IDS.LOADER_TIP}`);
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
    document.body.classList.add(DOM_CLASSES.DESKTOP_MODE);
    document.body.classList.remove(DOM_CLASSES.TOUCH_MODE);
  } else {
    document.body.classList.add(DOM_CLASSES.TOUCH_MODE);
    document.body.classList.remove(DOM_CLASSES.DESKTOP_MODE);
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
      // goToLiteVersion() no-ops on native; the menu button is also hidden there
      // (see setupTryLiteVersionButton) so this path isn't normally reachable.
      if (confirmed) goToLiteVersion({ reason: 'menu button' });
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
  // The lite version is a web-only fallback (old browsers / slow connections).
  // It isn't bundled in the native (Capacitor) build, so don't offer it there —
  // hide the menu entries and skip wiring. No effect on web (isNativeApp() false).
  if (isNativeApp()) {
    for (const id of [DOM_IDS.TRY_LITE_VERSION, DOM_IDS.MENU_LITE_VERSION]) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    return;
  }

  replaceStoredEventListener(
    document.getElementById(DOM_IDS.TRY_LITE_VERSION),
    'click',
    '__miniCycleUiBootTryLiteClickHandler',
    () => handleTryLiteVersionClick(deps)
  );
  replaceStoredEventListener(
    document.getElementById(DOM_IDS.MENU_LITE_VERSION),
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

  // Publish --header-total-height and keep it in sync with the live header
  // (runs after the mode-selector row is initialized so the measured box is
  // complete). Layout rules centre #task-view below the measured header so the
  // routine title never creeps under the mode selector. The ResizeObserver
  // catches any later layout changes.
  initHeaderLayout();

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

  // Surface any OPTIONAL features that failed to load during boot as a single,
  // non-blocking notice — so a silently-missing feature doesn't go unnoticed.
  featureAvailability.showDegradedModeWarning(getShowNotification());

  // Origin hygiene (docs-subdomain move, Jul 2026): Docsify's search plugin
  // used to store a multi-MB full-text index in THIS origin's localStorage
  // when the docs lived at minicycle.app/docs. The docs now live on their own
  // origin (docs.minicycle.app), so docsify.* keys here are permanent orphans
  // squatting on the ~5MB quota that user routines compete for — one user
  // measured 4.28MB used with ~55KB of routines. Deleting is safe: Docsify
  // transparently re-indexes if it ever runs on this origin again.
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('docsify.')) localStorage.removeItem(key);
    }
  } catch { /* storage unavailable — nothing to clean */ }

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
/**
 * Wire boot-time stub listeners for DEFERRED feature modules.
 *
 * A deferred module's own init() — which normally attaches its open-button
 * listener — does NOT run at boot, so the entry-point button would be dead.
 * Each stub: on first click, loads the module on-demand (its init then attaches
 * the real listener), removes itself, and re-dispatches the click so the real
 * handler runs. Loads are cached/idempotent, so this only happens once.
 *
 * @param {Object} deps - Dependencies container (uses deps.core.ensureModuleLoaded)
 */
function setupDeferredFeatureTriggers(deps) {
  const ensure = deps.core?.ensureModuleLoaded;
  if (typeof ensure !== 'function') {
    console.warn('⚠️ ensureModuleLoaded unavailable — deferred feature triggers skipped');
    return;
  }

  // Testing modal (#open-testing-modal) — loads testingModal + its integration
  // on first click. Uses DOCUMENT-LEVEL DELEGATION (capture phase) because the
  // settings modal that contains this button is re-rendered after boot, so a
  // listener bound to the specific node would end up on a stale/detached element.
  // The handler removes itself on first match; testingModal.init() then attaches
  // the real open handler, which the re-dispatched click triggers.
  // Both stubs use replaceStoredEventListener (remove-before-add via a stored
  // key on document) instead of plain addEventListener: on boot retry this
  // function runs again with a NEW `ensure` closure, and the plain pattern
  // would stack a second capture listener whose stale `ensure` targets the
  // superseded moduleLoader instance (July 2026 boot audit, M4).
  const onTestingOpenClick = async (e) => {
    const openBtn = e.target.closest?.('#' + DOM_IDS.OPEN_TESTING_MODAL);
    if (!openBtn) return;
    document.removeEventListener('click', onTestingOpenClick, true);
    await ensure('testingModal');             // attaches the real #open-testing-modal handler
    await ensure('testingModalIntegration');
    openBtn.click();                          // real handler (now attached) opens the modal
  };
  replaceStoredEventListener(document, 'click', '_miniCycleTestingOpenStub', onTestingOpenClick, true);

  // gamesManager — games are reachable only through the main menu, so load it on
  // the first menu-button click. Its init() runs checkGamesUnlock(), revealing
  // #games-menu-option (default display:none) if the game is unlocked, and wires
  // the games-panel listeners. Self-removing after the first load.
  const onMenuOpenForGames = (e) => {
    if (!e.target.closest?.(DOM_SELECTORS.MENU_BUTTON)) return;
    document.removeEventListener('click', onMenuOpenForGames, true);
    ensure('gamesManager');  // fire-and-forget; init reveals the menu item if unlocked
  };
  replaceStoredEventListener(document, 'click', '_miniCycleMenuGamesStub', onMenuOpenForGames, true);
}

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
  setupDeferredFeatureTriggers(deps);

  // Hide loader and focus input
  hideAppLoader();
  requestAnimationFrame(() => taskInput?.focus({ focusVisible: false }));

  // Native shell setup (Android/Capacitor): status bar theming, splash hide,
  // hardware back button. No-op on the web — self-gated by isNativeApp().
  initNativeShell();

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

  // ========== BACKUP REMINDER CHECK (non-blocking) ==========
  // Check if user should be reminded to back up their routines (14-day interval)
  setTimeout(() => {
    try {
      deps.features?.checkBackupReminderOnBoot?.();
    } catch (error) {
      console.warn('⚠️ Backup reminder check failed (non-critical):', error);
    }
  }, 3000); // Delay 3s to avoid interrupting initial UX
}

// ============================================================================
// MODULE INFO
// ============================================================================
