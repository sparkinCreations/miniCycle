/**
 * ============================================================================
 * app-uiBoot.js - UI Event Handlers & Boot Orchestration (Skeleton)
 * ============================================================================
 *
 * This file handles:
 * - The main bootUI() orchestration function
 * - All global DOM event listeners
 * - UI helper functions (loaders, etc.)
 *
 * RESPONSIBILITIES:
 * - Orchestrate the boot sequence (core → features → UI)
 * - Attach global event listeners
 * - Handle keyboard shortcuts
 * - UI utilities like loader/spinner
 *
 * IMPORT RULES:
 * - This file CAN import from app-coreBoot.js
 * - This file CAN import from app-featureBoot.js
 * - This file should NOT expose services to window.* (featureBoot does that)
 *
 * ============================================================================
 */

// ============================================================================
// MAIN BOOT ORCHESTRATOR
// ============================================================================

/**
 * Main boot function - orchestrates the entire app startup
 * This is the entry point called from miniCycle-main.js
 */
export async function bootUI() {
  console.log('🚀 MiniCycle boot starting...');
  const bootStart = Date.now();

  try {
    // ========== STEP 1: Import and initialize core ==========
    console.log('📦 Loading core...');
    const core = await import('./app-coreBoot.js');
    const {
      AppGlobalState,
      FeatureFlags,
      AppMeta,
      appInit,
      GlobalUtils,
      withV,
      initCore
    } = core;

    // Initialize core modules (AppState, migrations, etc.)
    await initCore();
    console.log('✅ Core initialized');

    // ========== STEP 2: Wait for core systems ==========
    console.log('⏳ Waiting for core systems...');
    await appInit.waitForCore();
    console.log('✅ Core systems ready');

    // ========== STEP 3: Boot feature modules ==========
    console.log('📦 Loading features...');
    const { bootFeatures } = await import('./app-featureBoot.js');
    const features = await bootFeatures({
      appInit,
      AppState: window.AppState,
      AppGlobalState,
      GlobalUtils,
      withV
    });
    console.log('✅ Features loaded');

    // ========== STEP 4: Attach global event listeners ==========
    console.log('🔗 Attaching event listeners...');
    attachGlobalEventListeners(features, GlobalUtils);
    console.log('✅ Event listeners attached');

    // ========== STEP 5: Run initial setup ==========
    console.log('🎬 Running initial setup...');
    await runInitialSetup(features);
    console.log('✅ Initial setup complete');

    // ========== STEP 6: Hide loader and mark ready ==========
    hideAppLoader();
    appInit.markAppReady();
    AppGlobalState.isInitializing = false;

    const bootTime = Date.now() - bootStart;
    console.log(`✅ MiniCycle ready in ${bootTime}ms`);

  } catch (error) {
    console.error('❌ Boot failed:', error);
    // HTML timeout will handle lite fallback if needed
    throw error;
  }
}

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

/**
 * Attach all global event listeners
 * NOTE: This function USES features but does NOT expose them to window.*
 */
function attachGlobalEventListeners(features, GlobalUtils) {
  const { safeAddEventListener, safeAddEventListenerById } = GlobalUtils;

  // ========== Keyboard Shortcuts ==========
  safeAddEventListener(document, 'keydown', handleGlobalKeydown);

  // ========== Global Click: Hide Task Buttons ==========
  safeAddEventListener(document, 'click', handleGlobalClickForTaskButtons);

  // ========== Global Click: Deselect in Switch Modal ==========
  safeAddEventListener(document, 'click', handleGlobalClickForSwitchModal);

  // ========== Title Editing ==========
  const titleElement = document.getElementById('mini-cycle-title');
  if (titleElement) {
    safeAddEventListener(titleElement, 'blur', handleMiniCycleTitleBlur);
  }

  // ========== Add Task Button ==========
  safeAddEventListenerById('add-task-button', 'click', handleAddTaskButtonClick);

  // ========== Add Task Input (Enter key) ==========
  const taskInput = document.getElementById('taskInput');
  if (taskInput) {
    safeAddEventListener(taskInput, 'keypress', handleTaskInputKeypress);
  }

  // ========== Reminders Modal ==========
  safeAddEventListenerById('open-reminders-modal', 'click', handleOpenRemindersModalClick);
  safeAddEventListenerById('close-reminders-btn', 'click', handleCloseRemindersBtnClick);
  safeAddEventListener(window, 'click', handleWindowClickForRemindersModal);

  // ========== Menu Button ==========
  safeAddEventListenerById('menu-btn', 'click', handleMenuButtonClick);

  // ========== First Touch Interaction ==========
  safeAddEventListener(document, 'touchstart', handleFirstTouchInteraction, { once: true });

  // ========== Passive Touchstart (for scroll performance) ==========
  safeAddEventListener(document, 'touchstart', handlePassiveTouchstart, { passive: true });

  console.log('✅ Global event listeners attached');
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
    window.performStateBasedUndo?.();
  }

  // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    window.performStateBasedRedo?.();
  }

  // ESC: Close modals (handled by modalManager, but we can add additional handling here)
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
 * Handle miniCycle title blur (rename)
 */
async function handleMiniCycleTitleBlur() {
  const titleElement = document.getElementById('mini-cycle-title');
  if (!titleElement) return;

  let newTitle = window.sanitizeInput?.(titleElement.textContent.trim()) || titleElement.textContent.trim();

  if (!newTitle) {
    // Restore original title
    const state = window.AppState?.get?.();
    const activeCycleId = state?.appState?.activeCycleId;
    if (activeCycleId && state?.data?.cycles?.[activeCycleId]) {
      titleElement.textContent = state.data.cycles[activeCycleId].name || activeCycleId;
    }
    return;
  }

  // Check if title changed
  const state = window.AppState?.get?.();
  const activeCycleId = state?.appState?.activeCycleId;
  const currentName = state?.data?.cycles?.[activeCycleId]?.name || activeCycleId;

  if (newTitle === currentName) return;

  // Update via AppState
  if (window.AppState?.isReady?.()) {
    await window.AppState.update(state => {
      if (state.data?.cycles?.[activeCycleId]) {
        state.data.cycles[activeCycleId].name = newTitle;
        state.metadata.lastModified = new Date().toISOString();
      }
    }, true);

    window.showNotification?.(`Renamed to "${newTitle}"`, 'success', 2000);
    console.log('✅ Cycle renamed to:', newTitle);
  }
}

/**
 * Handle add task button click
 */
function handleAddTaskButtonClick() {
  const taskInput = document.getElementById('taskInput');
  const taskText = taskInput?.value?.trim();

  if (taskText) {
    window.addTask?.(taskText);
    taskInput.value = '';
    taskInput.focus();
  }
}

/**
 * Handle Enter key in task input
 */
function handleTaskInputKeypress(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddTaskButtonClick();
  }
}

/**
 * Handle open reminders modal click
 */
function handleOpenRemindersModalClick() {
  const modal = document.getElementById('reminders-modal');
  if (modal) {
    modal.classList.remove('hidden');
    window.loadRemindersSettings?.();
    window.hideMainMenu?.();
    console.log('✅ Reminders modal opened');
  }
}

/**
 * Handle close reminders button click
 */
function handleCloseRemindersBtnClick() {
  const modal = document.getElementById('reminders-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Handle window click for reminders modal (close on backdrop)
 */
function handleWindowClickForRemindersModal(event) {
  const modal = document.getElementById('reminders-modal');
  if (event.target === modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Handle menu button click
 */
function handleMenuButtonClick() {
  const mainMenu = document.getElementById('main-menu');
  if (mainMenu) {
    mainMenu.classList.toggle('hidden');
    window.updateMainMenuHeader?.();
  }
}

/**
 * Handle first touch interaction (for enabling audio, etc.)
 */
function handleFirstTouchInteraction() {
  window.AppGlobalState.hasInteracted = true;
  console.log('✅ First touch interaction detected');
}

/**
 * Passive touchstart handler (for scroll performance)
 */
function handlePassiveTouchstart() {
  // Empty - just ensures passive listener is registered
}

// ============================================================================
// INITIAL SETUP
// ============================================================================

/**
 * Run initial app setup after features are loaded
 */
async function runInitialSetup(features) {
  // Load initial cycle data
  const schemaData = window.loadMiniCycleData?.();

  if (!schemaData) {
    console.log('🆕 No data found - showing onboarding...');
    window.onboardingManager?.startOnboarding?.();
    return;
  }

  const { cycles, activeCycle } = schemaData;

  if (!activeCycle || !cycles?.[activeCycle]) {
    console.log('🆕 No active cycle - showing cycle creation modal...');
    window.showCycleCreationModal?.();
    return;
  }

  // Load the active cycle
  console.log('📦 Loading cycle:', activeCycle);
  await window.loadMiniCycle?.(activeCycle);

  // Initialize UI components
  window.updateProgressBar?.();
  window.initCompletedTasksSection?.();
  window.saveToggleAutoReset?.();
  window.updateReminderButtons?.();
  window.checkOverdueTasks?.();

  // Start reminders if enabled
  window.startReminders?.();

  // Apply theme
  window.applyTheme?.();

  console.log('✅ Initial setup complete');
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Hide the app loader/splash screen
 */
function hideAppLoader() {
  const appLoader = document.getElementById('app-loader');
  if (appLoader) {
    appLoader.classList.add('hidden');
    setTimeout(() => {
      appLoader.style.display = 'none';
    }, 300);
  }
}

/**
 * Show a loading spinner with message
 */
export function showLoader(message = 'Processing...') {
  let loader = document.getElementById('global-loader');

  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'global-loader';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner"></div>
        <p class="loader-message">${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  } else {
    const messageEl = loader.querySelector('.loader-message');
    if (messageEl) messageEl.textContent = message;
    loader.classList.remove('hidden');
  }
}
window.showLoader = showLoader;

/**
 * Hide the loading spinner
 */
export function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.add('hidden');
  }
}
window.hideLoader = hideLoader;

/**
 * Run an async function with a loader
 */
export async function withLoader(asyncFunction, message = 'Processing...') {
  showLoader(message);
  try {
    return await asyncFunction();
  } finally {
    hideLoader();
  }
}
window.withLoader = withLoader;

// ============================================================================
// DEVICE DETECTION FALLBACK
// ============================================================================

/**
 * Fallback device detection if module fails to load
 */
function detectDeviceType() {
  if (window.deviceDetectionManager) {
    return; // Module loaded, use that instead
  }

  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isFinePointer && !isTouchDevice) {
    document.body.classList.add('desktop-mode');
    document.body.classList.remove('touch-mode');
  } else {
    document.body.classList.add('touch-mode');
    document.body.classList.remove('desktop-mode');
  }

  console.log('✅ Device type detected (fallback):', isFinePointer ? 'desktop' : 'touch');
}

// Run fallback detection if needed
if (!window.deviceDetectionManager) {
  detectDeviceType();
}

/**
 * Check if device is touch-capable
 */
export function isTouchDevice() {
  return 'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    !window.matchMedia('(pointer: fine)').matches;
}
window.isTouchDevice = isTouchDevice;
