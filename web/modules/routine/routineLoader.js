/**
 * miniCycle Routine Loader Module (Schema 2.5, DI-Pure)
 * - Pure module with explicit dependency injection
 * - No window probing, no stubs, no retry loops
 * - No window.* fallbacks (DI-pure)
 *
 * Handles loading and rendering routines (cycles) from AppState,
 * including task rendering, UI state updates, and theme application.
 *
 * @module routineLoader
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DOM_IDS } from '../core/constants.js';
// NOTE: taskToAddTaskOptions injected via DI to avoid duplicate module loading

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RoutineLoader', {
  appInit: optional(null),
  AppState: optional(null),
  loadMiniCycleData: optional(null),
  createInitialSchema25Data: optional(null),
  addTask: optional(null),
  updateThemeColor: optional(null),
  startReminders: optional(null),
  catchUpMissedRecurringTasks: optional(null),
  updateProgressBar: optional(null),
  checkCompleteAllButton: optional(null),
  updateMainMenuHeader: optional(null),
  updateStatsPanel: optional(null),
  syncAllTasksWithMode: optional(null),
  taskToAddTaskOptions: optional(null),  // From taskUtils - injected to avoid duplicate module loading
  updateSearchVisibility: optional(null),  // Task search visibility based on count
  syncModeFromToggles: optional(null),  // Sync mode selector with routine's saved mode
  completedTasksManager: optional(null)  // For organizing completed tasks into dropdown
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{appInit: Object|null, AppState: Object|null, loadMiniCycleData: Function|null, createInitialSchema25Data: Function|null, addTask: Function|null, updateThemeColor: Function|null, startReminders: Function|null, catchUpMissedRecurringTasks: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, updateMainMenuHeader: Function|null, updateStatsPanel: Function|null, syncAllTasksWithMode: Function|null, taskToAddTaskOptions: Function|null, updateSearchVisibility: Function|null, syncModeFromToggles: Function|null, completedTasksManager: Object|null}} */
const _deps = new Proxy({}, {
  get(_, prop) {
    return di.resolve()[prop];
  }
});

/**
 * Set dependencies for routine loader module
 * @param {Object} overrides - Dependency overrides
 * @param {Function} [overrides.AppState] - AppState getter or instance
 * @param {Function} [overrides.loadMiniCycleData] - Data loader function
 * @param {Function} [overrides.addTask] - Task addition function
 * @param {Function} [overrides.updateProgressBar] - Progress bar updater
 * @param {Function} [overrides.syncModeFromToggles] - Mode sync function
 */
function setRoutineLoaderDependencies(overrides = {}) {
  di.setDependencies(overrides);
}

/**
 * Get AppState instance (handles both function and direct references)
 * @returns {Object} AppState instance
 */
function getAppState() {
  // ✅ Handle both getter function and direct reference
  return typeof _deps.AppState === 'function' ? _deps.AppState() : _deps.AppState;
}

/**
 * Assert that a dependency has been injected
 * @param {string} name - Dependency name
 * @param {Function} fn - Dependency function to check
 * @throws {Error} If dependency is not a function
 */
function assertInjected(name, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`routineLoader: missing dependency ${name}`);
  }
}

/**
 * Load and render the active routine (cycle)
 * Main coordination function that loads tasks, updates UI, and syncs state.
 * Called in Phase 3 after all modules are initialized.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If loadMiniCycleData dependency is missing
 * @throws {Error} If addTask dependency is missing
 */
async function loadMiniCycle() {
  console.log('🔄 Loading miniCycle (Schema 2.5 only)...');

  assertInjected('loadMiniCycleData', _deps.loadMiniCycleData);
  assertInjected('addTask', _deps.addTask);

  const schemaData = _deps.loadMiniCycleData();

  if (!schemaData) {
    console.error('❌ No Schema 2.5 data found');
    _deps.createInitialSchema25Data?.();
    return;
  }

  const cycles = schemaData.cycles || schemaData.data?.cycles || {};
  const activeCycleId =
    schemaData.activeCycle ||
    schemaData.activeCycleId ||
    schemaData.appState?.activeCycleId ||
    schemaData.appState?.activeCycle ||
    null;

  if (!activeCycleId || !cycles[activeCycleId]) {
    console.error('❌ No valid active cycle found (id:', activeCycleId, ')');
    return;
  }

  const currentCycle = cycles[activeCycleId];

  // 1) Validate and repair cycle + task data (comprehensive, like import does)
  const cleaned = repairAndCleanTasks(currentCycle, activeCycleId);
  if (cleaned.wasModified) {
    console.log(`🔧 Saving repaired data for cycle "${activeCycleId}"`);
    await saveCycleData(activeCycleId, currentCycle);
  }

  // 2) Render tasks
  // ✅ FIXED: renderTasksToDOM now calls addTask with isLoading=true
  // This prevents addTask from pushing duplicate tasks to AppState
  // It only creates DOM elements from the existing task data
  renderTasksToDOM(currentCycle.tasks || []);

  // 2.5) Sync visual indicators with current mode
  // ✅ After rendering tasks, sync all delete-when-complete visual indicators (DI-pure)
  const syncFn = _deps.syncAllTasksWithMode;
  if (currentCycle.tasks && syncFn) {
    const currentMode = currentCycle.deleteCheckedTasks === true ? 'todo' : 'cycle';
    const tasksDataMap = {};
    currentCycle.tasks.forEach(task => {
      tasksDataMap[task.id] = task;
    });

    syncFn(currentMode, tasksDataMap, {
      DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
    });
    console.log(`✅ Synced all task visual indicators with ${currentMode} mode`);
  }

  // 3) Update UI state
  updateCycleUIState(currentCycle, schemaData.settings || {});

  // 4) Reminders
  await setupRemindersForCycle(schemaData.reminders || schemaData.customReminders || {});

  // 5) Dependent UI components
  updateDependentComponents();

  // 6) Organize completed tasks into dropdown (if feature enabled)
  _deps.completedTasksManager?.organize?.();

  console.log('✅ Cycle loading completed');
}

/**
 * Repair & cleanup - validates and repairs cycle-level AND task-level data
 * Handles corrupted or incomplete data gracefully (like import does)
 */
function repairAndCleanTasks(currentCycle, cycleKey = 'unknown') {
  let tasksModified = false;

  // ============================================================================
  // CYCLE-LEVEL VALIDATION (matches routineSwitcher._validateAndRepairCycleData)
  // ============================================================================

  // Ensure title exists
  if (!currentCycle.title || typeof currentCycle.title !== 'string') {
    currentCycle.title = cycleKey !== 'unknown' ? cycleKey : 'Untitled Routine';
    tasksModified = true;
    console.warn(`⚠️ Repaired missing cycle title: "${currentCycle.title}"`);
  }

  // Ensure cycleCount is a valid number
  if (typeof currentCycle.cycleCount !== 'number' || currentCycle.cycleCount < 0 || isNaN(currentCycle.cycleCount)) {
    currentCycle.cycleCount = 0;
    tasksModified = true;
    console.warn('⚠️ Repaired invalid cycleCount to 0');
  }

  // Ensure autoReset is a boolean
  if (typeof currentCycle.autoReset !== 'boolean') {
    currentCycle.autoReset = true;
    tasksModified = true;
    console.warn('⚠️ Repaired autoReset to default (true)');
  }

  // Ensure deleteCheckedTasks is a boolean
  if (typeof currentCycle.deleteCheckedTasks !== 'boolean') {
    currentCycle.deleteCheckedTasks = false;
    tasksModified = true;
    console.warn('⚠️ Repaired deleteCheckedTasks to default (false)');
  }

  // ============================================================================
  // TASK ARRAY VALIDATION
  // ============================================================================

  if (!currentCycle.tasks || !Array.isArray(currentCycle.tasks)) {
    currentCycle.tasks = [];
    tasksModified = true;
    console.warn('⚠️ Repaired invalid tasks array');
    return { tasks: [], wasModified: tasksModified };
  }

  const originalLength = currentCycle.tasks.length;

  // Determine current mode for deleteWhenComplete defaults
  const isToDoMode = currentCycle.deleteCheckedTasks === true;
  const currentMode = isToDoMode ? 'todo' : 'cycle';

  // ============================================================================
  // TASK-LEVEL VALIDATION (comprehensive, like import does)
  // ============================================================================

  currentCycle.tasks.forEach((task, index) => {
    if (!task) return;
    if (typeof task !== 'object') return; // Skip non-objects (strings, numbers, etc.)

    // ✅ Repair missing ID
    if (!task.id || typeof task.id !== 'string') {
      task.id = `task-${Date.now()}-${index}-${(task.text || '').length}`;
      tasksModified = true;
      console.warn('⚠️ Repaired task with missing ID:', task.id);
    }

    // ✅ Repair missing text (don't filter out yet)
    const hasText = task.text || task.taskText;
    if (!hasText || (typeof hasText === 'string' && hasText.trim() === '')) {
      task.text = `[Task ${index + 1}]`;
      tasksModified = true;
      console.warn('⚠️ Repaired task with missing text:', task.id);
    } else if (task.taskText && !task.text) {
      // Migrate legacy taskText to text
      task.text = task.taskText;
      delete task.taskText;
      tasksModified = true;
    }

    // ✅ Repair boolean fields with proper defaults
    if (typeof task.completed !== 'boolean') {
      task.completed = Boolean(task.completed);
      tasksModified = true;
    }

    if (typeof task.highPriority !== 'boolean') {
      task.highPriority = Boolean(task.highPriority);
      tasksModified = true;
    }

    if (typeof task.remindersEnabled !== 'boolean') {
      task.remindersEnabled = Boolean(task.remindersEnabled);
      tasksModified = true;
    }

    if (typeof task.recurring !== 'boolean') {
      task.recurring = Boolean(task.recurring);
      tasksModified = true;
    }

    // ✅ Repair dueDate (should be null, string, or number)
    if (task.dueDate === undefined) {
      task.dueDate = null;
      tasksModified = true;
    }

    // ✅ Repair recurringSettings (should be object if recurring)
    if (task.recurring && (!task.recurringSettings || typeof task.recurringSettings !== 'object')) {
      task.recurringSettings = {};
      tasksModified = true;
      console.warn('⚠️ Repaired missing recurringSettings for recurring task:', task.id);
    }

    // ✅ Repair missing deleteWhenCompleteSettings
    if (!task.deleteWhenCompleteSettings || typeof task.deleteWhenCompleteSettings !== 'object') {
      task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
      tasksModified = true;
      console.warn('⚠️ Repaired task with missing deleteWhenCompleteSettings:', task.id);
    }

    // ✅ ALWAYS sync deleteWhenComplete with current mode's setting
    // This ensures correct behavior when loading a cycle after mode switch
    const expectedValue = task.deleteWhenCompleteSettings[currentMode];
    if (task.deleteWhenComplete !== expectedValue) {
      task.deleteWhenComplete = expectedValue;
      tasksModified = true;
      console.log(`🔄 Synced task ${task.id} deleteWhenComplete to ${currentMode} mode: ${expectedValue}`);
    }
  });

  // ✅ ONLY filter out tasks that are completely null/undefined
  // DO NOT filter out tasks with empty strings (they've been repaired above)
  const validTasks = currentCycle.tasks.filter(t => {
    if (!t) return false; // Null or undefined
    if (typeof t !== 'object') return false; // Not an object
    // At this point, all tasks have been repaired to have .text and .id
    return true;
  });

  currentCycle.tasks = validTasks;

  const removedCount = originalLength - validTasks.length;
  if (removedCount > 0) {
    console.warn(`⚠️ Removed ${removedCount} corrupted tasks during sanitization`);
  }

  if (tasksModified) {
    console.log(`🔧 Cycle "${cycleKey}" data was repaired during load`);
  }

  return {
    tasks: validTasks,
    wasModified: tasksModified || validTasks.length !== originalLength
  };
}

/**
 * Render tasks - calls addTask which will create DOM elements
 * BUT we need to make sure existing tasks keep their IDs and completion states
 */
function renderTasksToDOM(tasks = []) {
  const list = document.getElementById(DOM_IDS.TASK_LIST);
  if (!list) return;

  list.innerHTML = '';

  // ✅ FIX: Don't call addTask during loading - it creates NEW tasks with NEW IDs
  // Instead, render tasks directly to DOM from the data already in AppState
  console.log(`🔄 Rendering ${tasks.length} existing tasks to DOM (without creating new ones)`);

  const taskToAddTaskOptions = _deps.taskToAddTaskOptions;
  if (typeof taskToAddTaskOptions !== 'function') {
    console.error('renderTasksToDOM: taskToAddTaskOptions not available - aborting to prevent task duplication');
    return;
  }
  tasks.forEach(task => {
    // Render task to DOM using shared options helper (injected via DI)
    const options = taskToAddTaskOptions(task);
    _deps.addTask(task.text || task.taskText || '', options);
  });

  // Update task search visibility based on count
  _deps.updateSearchVisibility?.(tasks.length);

  console.log('✅ Tasks rendered to DOM with original IDs and states preserved');
}

/**
 * Update UI state
 */
function updateCycleUIState(currentCycle, settings) {
  const titleElement = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
  if (titleElement) {
    titleElement.textContent = currentCycle.title || 'Untitled Cycle';
  }

  const toggleAutoReset = document.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
  const deleteCheckedTasks = document.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

  if (toggleAutoReset) {
    toggleAutoReset.checked = currentCycle.autoReset || false;
  }
  if (deleteCheckedTasks) {
    deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
  }

  // Sync mode selector dropdown and body classes with routine's saved mode
  _deps.syncModeFromToggles?.();

  applyThemeSettings(settings || {});
}

/**
 * Theme settings
 */
function applyThemeSettings(settings) {
  document.body.classList.toggle('dark-mode', !!settings.darkMode);
  document.documentElement.classList.toggle('dark-mode', !!settings.darkMode);
  console.log('applyThemes applied!!!');

  const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
  allThemes.forEach(t => document.body.classList.remove(t));

  if (settings.theme && settings.theme !== 'default') {
    document.body.classList.add(`theme-${settings.theme}`);
  }

  _deps.updateThemeColor?.();

  // Accessibility settings
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
  document.documentElement.classList.toggle('reduced-motion', !!settings.reducedMotion);
  document.body.classList.toggle('high-contrast', !!settings.highContrast);
  document.documentElement.style.setProperty('--font-size-base',
      (settings.fontSize && settings.fontSize !== '16') ? `${settings.fontSize}px` : '16px');
}





/**
 * Reminders
 */
async function setupRemindersForCycle(reminders) {
  const enableReminders = document.getElementById(DOM_IDS.ENABLE_REMINDERS);
  const frequencySection = document.getElementById(DOM_IDS.FREQUENCY_SECTION);
  if (!enableReminders) return;

  const enabled = reminders.enabled === true;
  enableReminders.checked = enabled;

  if (frequencySection) {
    frequencySection.classList.toggle('hidden', !enabled);
  }
  if (enabled) {
    _deps.startReminders?.();
  }

  // ✅ Catch up on missed recurring tasks when switching cycles
  if (_deps.catchUpMissedRecurringTasks) {
    console.log('🔄 Catching up on missed recurring tasks after cycle switch...');
    await _deps.catchUpMissedRecurringTasks();
  }
}

/**
 * Dependent UI refresh
 */
function updateDependentComponents() {
  _deps.updateProgressBar?.();
  _deps.checkCompleteAllButton?.();
  _deps.updateMainMenuHeader?.();
  _deps.updateStatsPanel?.();
}

/**
 * Persist cycle changes
 * ✅ Uses AppState.update() only - no direct localStorage writes
 * to prevent race conditions with concurrent saves
 */
async function saveCycleData(activeCycle, currentCycle) {
  // ✅ Wait for core systems to be ready (AppState + data)
  // This prevents conflicts with AppState initialization
  await _deps.appInit?.waitForCore();

  // ✅ Use AppState only (no localStorage fallback)
  const appState = getAppState();
  if (!appState?.isReady?.()) {
    console.error('❌ AppState not ready for saveCycleData - this should not happen after waitForCore()');
    return;
  }

  // Use AppState for coordinated saves
  try {
    await appState.update((state) => {
      if (state?.data?.cycles?.[activeCycle]) {
        state.data.cycles[activeCycle] = currentCycle;
        console.log(`💾 Saved cycle "${activeCycle}" via AppState`);
      }
    }, true); // immediate = true for cycle repairs
  } catch (e) {
    console.error('❌ Failed to save cycle data via AppState', e);
  }
}

// ✅ REMOVED: Backward compatibility global attachment
// featureBoot.js now handles window.loadMiniCycle exposure
// Prefer importing loadMiniCycle directly from this module

export {
  loadMiniCycle,
  repairAndCleanTasks,
  renderTasksToDOM,
  updateCycleUIState,
  applyThemeSettings,
  setupRemindersForCycle,
  updateDependentComponents,
  saveCycleData,
  setRoutineLoaderDependencies
};