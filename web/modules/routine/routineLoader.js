/**
 * miniCycle Routine Loader Module (Schema 2.5, DI-Pure)
 * - Pure module with explicit dependency injection
 * - No window probing, no stubs, no retry loops
 * - No window.* fallbacks (DI-pure)
 *
 * @module routineLoader
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';

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
  syncAllTasksWithMode: optional(null)
});

// Late-binding Deps via Proxy
const Deps = new Proxy({}, {
  get(_, prop) {
    return di.resolve()[prop];
  }
});

function setRoutineLoaderDependencies(overrides = {}) {
  di.setDependencies(overrides);
}

/**
 * Get AppState instance (handles both function and direct references)
 * @returns {Object} AppState instance
 */
function getAppState() {
  // ✅ Handle both getter function and direct reference
  return typeof Deps.AppState === 'function' ? Deps.AppState() : Deps.AppState;
}

function assertInjected(name, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`routineLoader: missing dependency ${name}`);
  }
}

/**
 * Main coordination function
 * NOTE: This is now called in Phase 3 (after all modules initialized)
 * so no need to wait for appInit - guaranteed to be ready
 */
async function loadMiniCycle() {
  console.log('🔄 Loading miniCycle (Schema 2.5 only)...');

  assertInjected('loadMiniCycleData', Deps.loadMiniCycleData);
  assertInjected('addTask', Deps.addTask);

  const schemaData = Deps.loadMiniCycleData();

  if (!schemaData) {
    console.error('❌ No Schema 2.5 data found');
    Deps.createInitialSchema25Data?.();
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
  const syncFn = Deps.syncAllTasksWithMode;
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
      task.id = `task-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
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
  const list = document.getElementById('taskList');
  if (!list) return;

  list.innerHTML = '';

  // ✅ FIX: Don't call addTask during loading - it creates NEW tasks with NEW IDs
  // Instead, render tasks directly to DOM from the data already in AppState
  console.log(`🔄 Rendering ${tasks.length} existing tasks to DOM (without creating new ones)`);

  tasks.forEach(task => {
    // Call addTask but ensure it doesn't create new task objects in AppState
    // The isLoading=true flag should prevent this, but it still generates new IDs
    // So we need to call addTask but make sure it uses the EXACT task data from AppState
    Deps.addTask(
      task.text || task.taskText || '',
      task.completed || false,   // ✅ Use ACTUAL completion state from AppState
      false,                      // do not save during load
      task.dueDate || null,
      task.highPriority || false,
      true,                       // isLoading - prevents saving
      task.remindersEnabled || false,
      task.recurring || false,
      task.id,                    // ✅ MUST use existing ID (removed fallback)
      task.recurringSettings || {}, // ✅ NOTE: This converts undefined to {}
      task.deleteWhenComplete,      // ✅ Pass through deleteWhenComplete
      task.deleteWhenCompleteSettings // ✅ Pass through settings
    );
  });

  console.log('✅ Tasks rendered to DOM with original IDs and states preserved');
}

/**
 * Update UI state
 */
function updateCycleUIState(currentCycle, settings) {
  const titleElement = document.getElementById('mini-cycle-title');
  if (titleElement) {
    titleElement.textContent = currentCycle.title || 'Untitled Cycle';
  }

  const toggleAutoReset = document.getElementById('toggleAutoReset');
  const deleteCheckedTasks = document.getElementById('deleteCheckedTasks');

  if (toggleAutoReset) {
    toggleAutoReset.checked = currentCycle.autoReset || false;
  }
  if (deleteCheckedTasks) {
    deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
  }

  applyThemeSettings(settings || {});
}

/**
 * Theme settings
 */
function applyThemeSettings(settings) {
  document.body.classList.toggle('dark-mode', !!settings.darkMode);
  console.log('applyThemes applied!!!');

  const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
  allThemes.forEach(t => document.body.classList.remove(t));

  if (settings.theme && settings.theme !== 'default') {
    document.body.classList.add(`theme-${settings.theme}`);
  }

  Deps.updateThemeColor?.();
}





/**
 * Reminders
 */
async function setupRemindersForCycle(reminders) {
  const enableReminders = document.getElementById('enableReminders');
  const frequencySection = document.getElementById('frequency-section');
  if (!enableReminders) return;

  const enabled = reminders.enabled === true;
  enableReminders.checked = enabled;

  if (frequencySection) {
    frequencySection.classList.toggle('hidden', !enabled);
  }
  if (enabled) {
    Deps.startReminders?.();
  }

  // ✅ Catch up on missed recurring tasks when switching cycles
  if (Deps.catchUpMissedRecurringTasks) {
    console.log('🔄 Catching up on missed recurring tasks after cycle switch...');
    await Deps.catchUpMissedRecurringTasks();
  }
}

/**
 * Dependent UI refresh
 */
function updateDependentComponents() {
  Deps.updateProgressBar?.();
  Deps.checkCompleteAllButton?.();
  Deps.updateMainMenuHeader?.();
  Deps.updateStatsPanel?.();
}

/**
 * Persist cycle changes
 * ✅ Uses AppState.update() only - no direct localStorage writes
 * to prevent race conditions with concurrent saves
 */
async function saveCycleData(activeCycle, currentCycle) {
  // ✅ Wait for core systems to be ready (AppState + data)
  // This prevents conflicts with AppState initialization
  await Deps.appInit?.waitForCore();

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