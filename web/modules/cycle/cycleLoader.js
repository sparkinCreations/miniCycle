/**
 * miniCycle Cycle Loader Module (Schema 2.5)
 * - Pure module with explicit dependency injection
 * - No window probing, no stubs, no retry loops
 *
 * @module cycleLoader
 * @version 1.347
 */

import { appInit } from '../appInitialization.js';

const Deps = {
  loadMiniCycleData: null,
  createInitialSchema25Data: null,
  addTask: null,
  updateThemeColor: null,
  startReminders: null,
  catchUpMissedRecurringTasks: null,
  updateProgressBar: null,
  checkCompleteAllButton: null,
  updateMainMenuHeader: null,
  updateStatsPanel: null
};

function setCycleLoaderDependencies(overrides = {}) {
  Object.assign(Deps, overrides);
}

function assertInjected(name, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`cycleLoader: missing dependency ${name}`);
  }
}

/**
 * Main coordination function
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

  // 1) Repair/clean
  const cleaned = repairAndCleanTasks(currentCycle);
  if (cleaned.wasModified) {
    await saveCycleData(activeCycleId, currentCycle);
  }

  // 2) Render tasks
  // ✅ FIXED: renderTasksToDOM now calls addTask with isLoading=true
  // This prevents addTask from pushing duplicate tasks to AppState
  // It only creates DOM elements from the existing task data
  renderTasksToDOM(currentCycle.tasks || []);

  // 3) Update UI state
  updateCycleUIState(currentCycle, schemaData.settings || {});

  // 4) Reminders
  await setupRemindersForCycle(schemaData.reminders || schemaData.customReminders || {});

  // 5) Dependent UI components
  updateDependentComponents();

  console.log('✅ Cycle loading completed');
}

/**
 * Repair & cleanup
 */
function repairAndCleanTasks(currentCycle) {
  if (!currentCycle.tasks || !Array.isArray(currentCycle.tasks)) {
    currentCycle.tasks = [];
    return { tasks: [], wasModified: false };
  }

  let tasksModified = false;
  const originalLength = currentCycle.tasks.length;

  currentCycle.tasks.forEach((task, index) => {
    if (!task) return;
    if (typeof task !== 'object') return; // Skip non-objects (strings, numbers, etc.)

    // ✅ Repair missing text (don't filter out yet)
    const hasText = task.text || task.taskText;
    if (!hasText || (typeof hasText === 'string' && hasText.trim() === '')) {
      task.text = `[Task ${index + 1}]`;
      tasksModified = true;
      console.warn('⚠️ Repaired task with missing text:', task.id);
    }
    
    // ✅ Repair missing ID
    if (!task.id) {
      task.id = `task-${Date.now()}-${index}`;
      tasksModified = true;
      console.warn('⚠️ Repaired task with missing ID');
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
      task.recurringSettings || {}
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
 */
async function saveCycleData(activeCycle, currentCycle) {
  // ✅ Wait for core systems to be ready (AppState + data)
  // This prevents conflicts with AppState initialization
  await appInit.waitForCore();

  const raw = localStorage.getItem('miniCycleData');
  if (!raw) return;
  try {
    const full = JSON.parse(raw);
    if (!full.data || !full.data.cycles) return;
    full.data.cycles[activeCycle] = currentCycle;
    if (full.metadata) full.metadata.lastModified = Date.now();
    localStorage.setItem('miniCycleData', JSON.stringify(full));
  } catch (e) {
    console.error('❌ Failed to save cycle data', e);
  }
}

/**
 * Optional minimal global attach for backward compatibility
 * (Prefer importing and calling the exported functions directly.)
 */
(function attachGlobalsOnce() {
  if (window.__cycleLoaderGlobalsAttached) return;
  window.__cycleLoaderGlobalsAttached = true;
  window.loadMiniCycle ||= loadMiniCycle;
})();

export {
  loadMiniCycle,
  repairAndCleanTasks,
  renderTasksToDOM,
  updateCycleUIState,
  applyThemeSettings,
  setupRemindersForCycle,
  updateDependentComponents,
  saveCycleData,
  setCycleLoaderDependencies
};