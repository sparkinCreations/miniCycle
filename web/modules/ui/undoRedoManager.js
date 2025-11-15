/**
 * miniCycle Undo/Redo Manager Module
 * - State-based undo/redo system with snapshot management
 * - CRITICAL: Cannot work without AppState - fails fast
 * - Pure module with explicit dependency injection
 *
 * @module undoRedoManager
 * @version 1.358
 * @pattern Strict Injection 🔧
 */

import { appInit } from '../core/appInit.js';

// ============ CONSTANTS ============
const UNDO_LIMIT = 20;
const UNDO_MIN_INTERVAL_MS = 300;
const UNDO_DB_WRITE_DEBOUNCE_MS = 3000;  // Batch IndexedDB writes every 3s

// ============ DEPENDENCY INJECTION ============
const Deps = {
  AppState: null,
  refreshUIFromState: null,
  AppGlobalState: null,
  getElementById: null,
  safeAddEventListener: null,
  wrapperActive: false,
  showNotification: null
};

export function setUndoRedoManagerDependencies(overrides = {}) {
  Object.assign(Deps, overrides);
  console.log('🔄 UndoRedoManager dependencies configured');
}

function assertInjected(name, value) {
  if (value === null || value === undefined) {
    throw new Error(`undoRedoManager: missing required dependency '${name}'. Call setUndoRedoManagerDependencies() first.`);
  }
}

// ============ UI INITIALIZATION ============

/**
 * Wire up undo/redo button event listeners
 * Called once during app initialization
 */
export function wireUndoRedoUI() {
  // Idempotent guard
  if (Deps.AppGlobalState.__undoRedoWired) {
    console.log('ℹ️ Undo/redo UI already wired');
    return;
  }
  Deps.AppGlobalState.__undoRedoWired = true;

  initializeUndoRedoButtons();

  const undoBtn = Deps.getElementById('undo-btn');
  const redoBtn = Deps.getElementById('redo-btn');

  if (!undoBtn || !redoBtn) {
    console.warn('⚠️ Undo/redo buttons not found in DOM - keyboard shortcuts will still work');
    return;
  }

  assertInjected('safeAddEventListener', Deps.safeAddEventListener);

  Deps.safeAddEventListener(undoBtn, 'click', () => performStateBasedUndo());
  Deps.safeAddEventListener(redoBtn, 'click', () => performStateBasedRedo());

  console.log('✅ Undo/redo UI wired');
}

/**
 * Initialize undo/redo buttons to hidden state
 */
export function initializeUndoRedoButtons() {
  const undoBtn = Deps.getElementById('undo-btn');
  const redoBtn = Deps.getElementById('redo-btn');

  if (undoBtn) {
    undoBtn.hidden = true;
    undoBtn.disabled = true;
  }
  if (redoBtn) {
    redoBtn.hidden = true;
    redoBtn.disabled = true;
  }

  console.log('🔘 Undo/redo buttons initialized (hidden by default)');
}

/**
 * Capture initial snapshot after data loads
 */
export function captureInitialSnapshot() {
  assertInjected('AppState', Deps.AppState);

  const currentState = Deps.AppState.get();
  if (currentState) {
    console.log('📸 Capturing initial snapshot...');
    captureStateSnapshot(currentState);
  }
}

// ============ STATE SUBSCRIPTION ============

/**
 * Set up AppState subscription for automatic snapshots
 */
export function setupStateBasedUndoRedo() {
  assertInjected('AppState', Deps.AppState);

  if (!Deps.AppState.isReady?.()) {
    console.warn('⚠️ State module not ready for undo/redo setup');
    return;
  }

  // Skip installing when wrapper is active
  if (Deps.wrapperActive) {
    console.log('ℹ️ Undo subscriber skipped (wrapper handles snapshots)');
    return;
  }

  try {
    Deps.AppState.subscribe('undo-system', (newState, oldState) => {
      // Runtime guard if wrapper activates later
      if (Deps.wrapperActive) return;

      // Skip during cycle switches
      if (Deps.AppGlobalState.isSwitchingCycles) return;

      if (!Deps.AppGlobalState.isPerformingUndoRedo &&
          oldState?.data?.cycles && newState?.data?.cycles) {
        const activeCycle = newState.appState.activeCycleId;
        if (activeCycle && oldState.data.cycles[activeCycle] && newState.data.cycles[activeCycle]) {
          const oldCycle = oldState.data.cycles[activeCycle];
          const newCycle = newState.data.cycles[activeCycle];

          const tasksChanged = JSON.stringify(oldCycle.tasks) !== JSON.stringify(newCycle.tasks);
          const titleChanged = oldCycle.title !== newCycle.title;
          const settingsChanged = oldCycle.autoReset !== newCycle.autoReset ||
                                  oldCycle.deleteCheckedTasks !== newCycle.deleteCheckedTasks;

          if (tasksChanged || titleChanged || settingsChanged) {
            captureStateSnapshot(oldState);
          }
        }
      }
    });
    console.log('✅ State-based undo/redo system initialized');
  } catch (subscriptionError) {
    console.warn('⚠️ Failed to subscribe to state changes:', subscriptionError);
  }
}

/**
 * Enable undo system on first user interaction
 * Call this when user performs their first action
 */
export function enableUndoSystemOnFirstInteraction() {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  if (Deps.AppGlobalState.isInitializing) {
    console.log('✅ First user interaction detected - enabling undo system');
    Deps.AppGlobalState.isInitializing = false;
  }
}

// ============ SNAPSHOT MANAGEMENT ============

/**
 * Capture complete state snapshot with deduplication
 */
export function captureStateSnapshot(state) {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  // Don't capture snapshots during initial app load
  if (Deps.AppGlobalState.isInitializing) {
    console.log('⏭️ Skipping snapshot during initialization');
    return;
  }

  // Don't capture snapshots during cycle switches
  if (Deps.AppGlobalState.isSwitchingCycles) {
    console.log('⏭️ Skipping snapshot during cycle switch');
    return;
  }

  // ✅ FIX #8: Don't capture snapshots during batch operations (reset, complete all)
  if (Deps.AppGlobalState.isResetting) {
    console.log('⏭️ Skipping snapshot during batch reset operation');
    return;
  }

  if (!state?.data?.cycles || !state?.appState?.activeCycleId) {
    console.warn('⚠️ Invalid state for snapshot');
    return;
  }

  const activeCycle = state.appState.activeCycleId;
  const currentCycle = state.data.cycles[activeCycle];
  if (!currentCycle) return;

  const snapshot = {
    activeCycleId: activeCycle,
    tasks: structuredClone(currentCycle.tasks || []),
    recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
    title: currentCycle.title || "Untitled miniCycle",
    autoReset: currentCycle.autoReset,
    deleteCheckedTasks: currentCycle.deleteCheckedTasks,
    cycleCount: currentCycle.cycleCount || 0,  // ✅ Include cycle count in snapshot
    timestamp: Date.now()
  };

  // ✅ Build and cache signature once for reuse
  const sig = buildSnapshotSignature(snapshot);
  snapshot._sig = sig;  // Cache on object

  const now = Date.now();

  // Throttle identical snapshots
  if (sig === Deps.AppGlobalState.lastSnapshotSignature &&
      now - Deps.AppGlobalState.lastSnapshotTs < UNDO_MIN_INTERVAL_MS) {
    return;
  }

  // Skip if last on stack is identical (use cached signature if available)
  const last = Deps.AppGlobalState.activeUndoStack.at(-1);
  if (last) {
    const lastSig = last._sig || buildSnapshotSignature(last);
    if (lastSig === sig) return;
  }

  console.log('📸 Capturing snapshot:', {
    taskCount: snapshot.tasks.length,
    title: snapshot.title,
    stackSize: Deps.AppGlobalState.activeUndoStack.length
  });

  Deps.AppGlobalState.activeUndoStack.push(snapshot);
  if (Deps.AppGlobalState.activeUndoStack.length > UNDO_LIMIT) {
    Deps.AppGlobalState.activeUndoStack.shift();
  }

  // Update dedupe trackers
  Deps.AppGlobalState.lastSnapshotSignature = sig;
  Deps.AppGlobalState.lastSnapshotTs = now;

  Deps.AppGlobalState.activeRedoStack = [];
  updateUndoRedoButtons();

  // ✅ Save to IndexedDB (debounced to avoid excessive writes)
  saveUndoStackToIndexedDB(
    activeCycle,
    Deps.AppGlobalState.activeUndoStack,
    Deps.AppGlobalState.activeRedoStack
  );
}

/**
 * Build snapshot signature for comparison
 */
export function buildSnapshotSignature(s) {
  if (!s) return '';
  return JSON.stringify({
    c: s.activeCycleId,
    t: (s.tasks || []).map(t => ({
      id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks
  });
}

/**
 * Analyze what changed between two snapshots
 * Returns a descriptive message like "Task added" or "Task reordered"
 */
function describeChange(fromSnapshot, toSnapshot) {
  if (!fromSnapshot || !toSnapshot) return 'Change';

  const fromTasks = fromSnapshot.tasks || [];
  const toTasks = toSnapshot.tasks || [];

  // Check for cycle changes
  if (fromSnapshot.title !== toSnapshot.title) {
    return 'Cycle renamed';
  }
  if (fromSnapshot.autoReset !== toSnapshot.autoReset) {
    return 'Mode changed';
  }
  if (fromSnapshot.deleteCheckedTasks !== toSnapshot.deleteCheckedTasks) {
    return 'Mode changed';
  }

  // Check task count changes
  const countDiff = toTasks.length - fromTasks.length;
  if (countDiff > 0) {
    return countDiff === 1 ? 'Task added' : `${countDiff} tasks added`;
  }
  if (countDiff < 0) {
    const deleted = Math.abs(countDiff);
    return deleted === 1 ? 'Task deleted' : `${deleted} tasks deleted`;
  }

  // Same count - check for modifications
  const fromTaskMap = new Map(fromTasks.map(t => [t.id, t]));
  const toTaskMap = new Map(toTasks.map(t => [t.id, t]));

  // Check for text changes
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask && fromTask.text !== toTask.text) {
      return 'Task edited';
    }
  }

  // Check for completion changes
  let completedCount = 0;
  let uncompletedCount = 0;
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask) {
      if (!fromTask.completed && toTask.completed) completedCount++;
      if (fromTask.completed && !toTask.completed) uncompletedCount++;
    }
  }
  if (completedCount > 0) {
    return completedCount === 1 ? 'Task completed' : `${completedCount} tasks completed`;
  }
  if (uncompletedCount > 0) {
    return uncompletedCount === 1 ? 'Task uncompleted' : `${uncompletedCount} tasks uncompleted`;
  }

  // Check for reordering
  const fromOrder = fromTasks.map(t => t.id).join(',');
  const toOrder = toTasks.map(t => t.id).join(',');
  if (fromOrder !== toOrder) {
    return 'Tasks reordered';
  }

  // Check for priority changes
  for (const [id, toTask] of toTaskMap) {
    const fromTask = fromTaskMap.get(id);
    if (fromTask && fromTask.highPriority !== toTask.highPriority) {
      return 'Priority changed';
    }
  }

  return 'Change';
}

/**
 * Compare two snapshots for equality
 * Uses cached signatures if available for performance
 */
export function snapshotsEqual(a, b) {
  if (!a || !b) return false;

  // ✅ Use cached signatures if available
  if (a._sig && b._sig) {
    return a._sig === b._sig;
  }

  // Fallback to building (shouldn't happen often)
  return buildSnapshotSignature(a) === buildSnapshotSignature(b);
}

// ============ UNDO/REDO OPERATIONS ============

/**
 * Perform undo operation
 */
export async function performStateBasedUndo() {
  assertInjected('AppState', Deps.AppState);
  assertInjected('AppGlobalState', Deps.AppGlobalState);
  assertInjected('refreshUIFromState', Deps.refreshUIFromState);

  if (Deps.AppGlobalState.activeUndoStack.length === 0) {
    console.warn('⚠️ Nothing to undo');
    return;
  }

  if (!Deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  Deps.AppGlobalState.isPerformingUndoRedo = true;

  // ✅ Create rollback points
  const rollbackState = structuredClone(Deps.AppState.get());
  const rollbackUndoStack = [...Deps.AppGlobalState.activeUndoStack];
  const rollbackRedoStack = [...Deps.AppGlobalState.activeRedoStack];

  try {
    const currentState = Deps.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      cycleCount: currentCycle?.cycleCount || 0,  // ✅ Include cycle count
      timestamp: Date.now()
    };

    let snap = null;
    let skippedDuplicates = 0;
    while (Deps.AppGlobalState.activeUndoStack.length) {
      const candidate = Deps.AppGlobalState.activeUndoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
      skippedDuplicates++;
    }
    console.log(`🔍 Undo: skipped ${skippedDuplicates} duplicates, found snapshot:`, !!snap);
    if (!snap) {
      console.warn('⚠️ No valid undo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    Deps.AppGlobalState.activeRedoStack.push(currentSnapshot);

    await Deps.AppState.update(state => {
      if (snap.activeCycleId && snap.activeCycleId !== state.appState.activeCycleId) {
        state.appState.activeCycleId = snap.activeCycleId;
      }
      const cid = state.appState.activeCycleId;
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
      if ('cycleCount' in snap) cycle.cycleCount = snap.cycleCount;  // ✅ Restore cycle count
    }, true);

    await Promise.resolve();
    Deps.refreshUIFromState(Deps.AppState.get());

    // Wait for next tick to ensure all rendering state updates complete
    await new Promise(resolve => setTimeout(resolve, 0));

    updateUndoRedoButtons();

    // ✅ Save updated stacks to IndexedDB
    if (currentActive) {
      saveUndoStackToIndexedDB(
        currentActive,
        Deps.AppGlobalState.activeUndoStack,
        Deps.AppGlobalState.activeRedoStack
      );
    }

    // ✅ Show success notification
    if (Deps.showNotification) {
      const changeDesc = describeChange(currentSnapshot, snap);
      const stepsLeft = Deps.AppGlobalState.activeUndoStack.length;
      const stepsText = stepsLeft === 0 ? 'no steps left' :
                        stepsLeft === 1 ? '1 step left' :
                        `${stepsLeft} steps left`;
      Deps.showNotification(`↩️ Undone: ${changeDesc} (${stepsText})`, 'success', 2000);
    }

    console.log('✅ Undo completed');
  } catch (e) {
    console.error('❌ Undo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await Deps.AppState.set(rollbackState);
      Deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      Deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (Deps.showNotification) {
        Deps.showNotification('⚠️ Undo failed - state restored', 'error', 3000);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    Deps.AppGlobalState.isPerformingUndoRedo = false;
  }
}

/**
 * Perform redo operation
 */
export async function performStateBasedRedo() {
  assertInjected('AppState', Deps.AppState);
  assertInjected('AppGlobalState', Deps.AppGlobalState);
  assertInjected('refreshUIFromState', Deps.refreshUIFromState);

  if (Deps.AppGlobalState.activeRedoStack.length === 0) {
    console.warn('⚠️ Nothing to redo');
    return;
  }

  if (!Deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  Deps.AppGlobalState.isPerformingUndoRedo = true;

  // ✅ Create rollback points
  const rollbackState = structuredClone(Deps.AppState.get());
  const rollbackUndoStack = [...Deps.AppGlobalState.activeUndoStack];
  const rollbackRedoStack = [...Deps.AppGlobalState.activeRedoStack];

  try {
    const currentState = Deps.AppState.get();
    const currentActive = currentState.appState.activeCycleId;
    const currentCycle = currentState.data.cycles[currentActive];

    const currentSnapshot = {
      activeCycleId: currentActive,
      tasks: structuredClone(currentCycle?.tasks || []),
      recurringTemplates: structuredClone(currentCycle?.recurringTemplates || {}),
      title: currentCycle?.title,
      autoReset: currentCycle?.autoReset,
      deleteCheckedTasks: currentCycle?.deleteCheckedTasks,
      cycleCount: currentCycle?.cycleCount || 0,  // ✅ Include cycle count
      timestamp: Date.now()
    };

    let snap = null;
    let skippedDuplicates = 0;
    while (Deps.AppGlobalState.activeRedoStack.length) {
      const candidate = Deps.AppGlobalState.activeRedoStack.pop();
      if (!snapshotsEqual(candidate, currentSnapshot)) {
        snap = candidate;
        break;
      }
      skippedDuplicates++;
    }
    console.log(`🔍 Redo: skipped ${skippedDuplicates} duplicates, found snapshot:`, !!snap);
    if (!snap) {
      console.warn('⚠️ No valid redo snapshot found');
      updateUndoRedoButtons();
      return;
    }

    Deps.AppGlobalState.activeUndoStack.push(currentSnapshot);

    await Deps.AppState.update(state => {
      if (snap.activeCycleId && snap.activeCycleId !== state.appState.activeCycleId) {
        state.appState.activeCycleId = snap.activeCycleId;
      }
      const cid = state.appState.activeCycleId;
      const cycle = state.data.cycles[cid] || (state.data.cycles[cid] = {});
      cycle.tasks = structuredClone(snap.tasks || []);
      cycle.recurringTemplates = structuredClone(snap.recurringTemplates || {});
      if (snap.title) cycle.title = snap.title;
      if ('autoReset' in snap) cycle.autoReset = snap.autoReset;
      if ('deleteCheckedTasks' in snap) cycle.deleteCheckedTasks = snap.deleteCheckedTasks;
      if ('cycleCount' in snap) cycle.cycleCount = snap.cycleCount;  // ✅ Restore cycle count
    }, true);

    await Promise.resolve();
    Deps.refreshUIFromState(Deps.AppState.get());

    // Wait for next tick to ensure all rendering state updates complete
    await new Promise(resolve => setTimeout(resolve, 0));

    updateUndoRedoButtons();

    // ✅ Save updated stacks to IndexedDB
    if (currentActive) {
      saveUndoStackToIndexedDB(
        currentActive,
        Deps.AppGlobalState.activeUndoStack,
        Deps.AppGlobalState.activeRedoStack
      );
    }

    // ✅ Show success notification
    if (Deps.showNotification) {
      const changeDesc = describeChange(currentSnapshot, snap);
      const stepsLeft = Deps.AppGlobalState.activeRedoStack.length;
      const stepsText = stepsLeft === 0 ? 'no steps left' :
                        stepsLeft === 1 ? '1 step left' :
                        `${stepsLeft} steps left`;
      Deps.showNotification(`↪️ Redone: ${changeDesc} (${stepsText})`, 'success', 2000);
    }

    console.log('✅ Redo completed');
  } catch (e) {
    console.error('❌ Redo failed, rolling back:', e);

    // ✅ Rollback on failure
    try {
      await Deps.AppState.set(rollbackState);
      Deps.AppGlobalState.activeUndoStack = rollbackUndoStack;
      Deps.AppGlobalState.activeRedoStack = rollbackRedoStack;
      updateUndoRedoButtons();

      if (Deps.showNotification) {
        Deps.showNotification('⚠️ Redo failed - state restored', 'error', 3000);
      }
    } catch (rollbackError) {
      console.error('❌ Rollback also failed:', rollbackError);
    }

    throw e; // Re-throw so caller knows it failed
  } finally {
    Deps.AppGlobalState.isPerformingUndoRedo = false;
  }
}

// ============ UI UPDATES ============

/**
 * Update undo/redo button enabled/disabled states
 */
export function updateUndoRedoButtonStates() {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  const undoBtn = Deps.getElementById('undo-btn');
  const redoBtn = Deps.getElementById('redo-btn');
  const undoCount = Deps.AppGlobalState.activeUndoStack.length;
  const redoCount = Deps.AppGlobalState.activeRedoStack.length;

  if (undoBtn) {
    undoBtn.disabled = undoCount === 0;
    undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
  }
  if (redoBtn) {
    redoBtn.disabled = redoCount === 0;
    redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
  }

  console.log(`🔘 Button states: undo=${undoCount} disabled=${undoBtn?.disabled}, redo=${redoCount} disabled=${redoBtn?.disabled}`);
}

/**
 * Update undo/redo button visibility
 */
export function updateUndoRedoButtonVisibility() {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  const undoBtn = Deps.getElementById('undo-btn');
  const redoBtn = Deps.getElementById('redo-btn');
  const undoCount = Deps.AppGlobalState.activeUndoStack.length;
  const redoCount = Deps.AppGlobalState.activeRedoStack.length;

  if (undoBtn) undoBtn.hidden = undoCount === 0;
  if (redoBtn) redoBtn.hidden = redoCount === 0;

  console.log(`👁️ Button visibility: undo hidden=${undoBtn?.hidden}, redo hidden=${redoBtn?.hidden}`);
}

/**
 * Update undo/redo button states and visibility (convenience wrapper)
 */
export function updateUndoRedoButtons() {
  updateUndoRedoButtonStates();
  updateUndoRedoButtonVisibility();
}

// ============ CYCLE LIFECYCLE INTEGRATION ============

/**
 * Handle cycle switch - save current, load new
 * Called by cycleSwitcher when user switches cycles
 */
export async function onCycleSwitched(newCycleId) {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  const oldCycleId = Deps.AppGlobalState.activeCycleIdForUndo;

  if (oldCycleId === newCycleId) {
    console.log('ℹ️ Same cycle, no undo stack swap needed');
    return;
  }

  console.log(`🔄 Switching undo context: "${oldCycleId}" → "${newCycleId}"`);

  // ✅ Set flag to block snapshot capture during transition
  Deps.AppGlobalState.isSwitchingCycles = true;

  try {
    // 1. Save current cycle's stacks to IndexedDB
    if (oldCycleId) {
      await saveUndoStackToIndexedDB(
        oldCycleId,
        Deps.AppGlobalState.activeUndoStack,
        Deps.AppGlobalState.activeRedoStack
      );
    }

    // 2. Clear in-memory stacks
    Deps.AppGlobalState.activeUndoStack = [];
    Deps.AppGlobalState.activeRedoStack = [];

    // 3. Load new cycle's stacks from IndexedDB
    const loaded = await loadUndoStackFromIndexedDB(newCycleId);
    Deps.AppGlobalState.activeUndoStack = loaded.undoStack || [];
    Deps.AppGlobalState.activeRedoStack = loaded.redoStack || [];

    // 4. Update tracking
    Deps.AppGlobalState.activeCycleIdForUndo = newCycleId;

    // 5. Update UI
    updateUndoRedoButtons();

    console.log(`✅ Loaded ${loaded.undoStack.length} undo, ${loaded.redoStack.length} redo steps`);

    // ✅ Small delay to let cycle fully load before re-enabling snapshots
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle switching
    console.error('❌ Cycle switch failed:', e);

    // Clear stacks to prevent stale data
    Deps.AppGlobalState.activeUndoStack = [];
    Deps.AppGlobalState.activeRedoStack = [];
    Deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    updateUndoRedoButtons();

    if (Deps.showNotification) {
      Deps.showNotification('⚠️ Undo history unavailable for this cycle', 'warning', 3000);
    }
  } finally {
    // ✅ Always clear the flag, even on error
    Deps.AppGlobalState.isSwitchingCycles = false;
    console.log('🔓 Cycle switch complete, snapshots re-enabled');
  }
}

/**
 * Handle cycle creation - initialize empty stacks
 * Called by cycleManager when new cycle is created
 */
export async function onCycleCreated(cycleId) {
  console.log(`🆕 New cycle created: "${cycleId}" - initializing empty undo stack`);

  try {
    // Initialize empty stacks in IndexedDB
    await saveUndoStackToIndexedDB(cycleId, [], []);

    // Set as active cycle for undo and clear in-memory stacks
    // (newly created cycles immediately become active)
    Deps.AppGlobalState.activeCycleIdForUndo = cycleId;
    Deps.AppGlobalState.activeUndoStack = [];
    Deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle creation
    console.error('❌ Failed to initialize undo stack for new cycle:', e);

    // Still set up empty stacks in memory even if IndexedDB fails
    Deps.AppGlobalState.activeCycleIdForUndo = cycleId;
    Deps.AppGlobalState.activeUndoStack = [];
    Deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();

    // Don't notify user - this is an internal operation
  }
}

/**
 * Handle cycle deletion - cleanup IndexedDB
 * Called by cycleManager when cycle is deleted
 */
export async function onCycleDeleted(cycleId) {
  console.log(`🗑️ Cycle deleted: "${cycleId}" - removing undo history`);

  try {
    // Remove from IndexedDB
    await deleteUndoStackFromIndexedDB(cycleId);

    // If this was the active cycle, clear memory
    if (Deps.AppGlobalState.activeCycleIdForUndo === cycleId) {
      Deps.AppGlobalState.activeUndoStack = [];
      Deps.AppGlobalState.activeRedoStack = [];
      Deps.AppGlobalState.activeCycleIdForUndo = null;
      updateUndoRedoButtons();
    }
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle deletion
    console.error('❌ Failed to delete undo stack:', e);

    // Still clean up memory even if IndexedDB fails
    if (Deps.AppGlobalState.activeCycleIdForUndo === cycleId) {
      Deps.AppGlobalState.activeUndoStack = [];
      Deps.AppGlobalState.activeRedoStack = [];
      Deps.AppGlobalState.activeCycleIdForUndo = null;
      updateUndoRedoButtons();
    }

    // Don't notify user - this is an internal cleanup operation
  }
}

/**
 * Handle cycle rename - migrate IndexedDB entry
 * Called by cycleSwitcher when cycle is renamed
 */
export async function onCycleRenamed(oldCycleId, newCycleId) {
  console.log(`📝 Cycle renamed: "${oldCycleId}" → "${newCycleId}"`);

  try {
    // Migrate in IndexedDB
    await renameUndoStackInIndexedDB(oldCycleId, newCycleId);

    // Update in-memory tracking
    if (Deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      Deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    }
  } catch (e) {
    // ✅ FIX #5: Error boundary for cycle rename
    console.error('❌ Failed to rename undo stack:', e);

    // Still update in-memory tracking even if IndexedDB fails
    if (Deps.AppGlobalState.activeCycleIdForUndo === oldCycleId) {
      Deps.AppGlobalState.activeCycleIdForUndo = newCycleId;
    }

    // Don't notify user - this is an internal operation
  }
}

/**
 * Initialize undo system for app startup
 * Loads current cycle's undo history from IndexedDB
 */
export async function initializeUndoSystemForApp() {
  assertInjected('AppState', Deps.AppState);
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  console.log('🔄 Initializing undo system...');

  try {
    // 1. Initialize IndexedDB
    await initializeUndoIndexedDB();

    // 2. Get current active cycle
    const currentState = Deps.AppState.get();
    const activeCycleId = currentState?.appState?.activeCycleId;

    if (!activeCycleId) {
      console.warn('⚠️ No active cycle for undo initialization');
      return;
    }

    // 3. Load that cycle's undo history
    const loaded = await loadUndoStackFromIndexedDB(activeCycleId);
    Deps.AppGlobalState.activeUndoStack = loaded.undoStack || [];
    Deps.AppGlobalState.activeRedoStack = loaded.redoStack || [];
    Deps.AppGlobalState.activeCycleIdForUndo = activeCycleId;

    // 4. Update UI
    updateUndoRedoButtons();

    // 5. Set up page unload handler to force immediate save
    window.addEventListener('beforeunload', () => {
      // Clear debounce timeout and save immediately
      if (dbWriteTimeout) {
        clearTimeout(dbWriteTimeout);
        dbWriteTimeout = null;
      }

      const cycleId = Deps.AppGlobalState.activeCycleIdForUndo;
      if (cycleId && undoDB) {
        // Force immediate synchronous save (no await)
        try {
          const transaction = undoDB.transaction(["undoStacks"], "readwrite");
          const objectStore = transaction.objectStore("undoStacks");

          const data = {
            cycleId,
            undoStack: Deps.AppGlobalState.activeUndoStack || [],
            redoStack: Deps.AppGlobalState.activeRedoStack || [],
            lastUpdated: Date.now(),
            version: "1.344"
          };

          objectStore.put(data);
          console.log('💾 Force-saved undo history on page unload');
        } catch (e) {
          console.warn('⚠️ Failed to force-save undo history:', e);
        }
      }
    });

    console.log(`✅ Undo system initialized with ${loaded.undoStack.length} undo steps`);
  } catch (e) {
    // ✅ FIX #5: Error boundary for undo system initialization
    console.error('❌ Undo system initialization failed:', e);

    // Initialize with empty stacks to ensure app still works
    Deps.AppGlobalState.activeUndoStack = [];
    Deps.AppGlobalState.activeRedoStack = [];
    updateUndoRedoButtons();

    if (Deps.showNotification) {
      Deps.showNotification('⚠️ Undo history unavailable', 'warning', 3000);
    }
  }
}

// ============ INDEXEDDB PERSISTENCE ============

let undoDB = null;  // Database connection
let dbWriteTimeout = null;  // Debounce timer

/**
 * Initialize IndexedDB for undo history persistence
 * Gracefully degrades if IndexedDB unavailable (private browsing)
 */
export async function initializeUndoIndexedDB() {
  try {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("miniCycleUndoHistory", 1);

      request.onerror = () => {
        console.warn('⚠️ IndexedDB unavailable - undo limited to session only');
        undoDB = null;
        resolve(false);
      };

      request.onsuccess = (event) => {
        undoDB = event.target.result;
        console.log('✅ IndexedDB undo persistence enabled');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains("undoStacks")) {
          const objectStore = db.createObjectStore("undoStacks", { keyPath: "cycleId" });
          console.log('🔧 Created undoStacks object store');
        }
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB initialization failed:', e);
    undoDB = null;
    return false;
  }
}

/**
 * Save undo/redo stacks to IndexedDB (debounced)
 */
export function saveUndoStackToIndexedDB(cycleId, undoStack, redoStack) {
  if (!undoDB) return;  // Graceful degradation
  if (!cycleId) return;

  // Debounce writes
  if (dbWriteTimeout) {
    clearTimeout(dbWriteTimeout);
  }

  dbWriteTimeout = setTimeout(async () => {
    try {
      const transaction = undoDB.transaction(["undoStacks"], "readwrite");
      const objectStore = transaction.objectStore("undoStacks");

      const data = {
        cycleId,
        undoStack: undoStack || [],
        redoStack: redoStack || [],
        lastUpdated: Date.now(),
        version: "1.344"
      };

      const request = objectStore.put(data);

      // ✅ FIX #11: Properly await IndexedDB operation
      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`💾 Saved undo history for "${cycleId}" (${undoStack?.length || 0} undo, ${redoStack?.length || 0} redo)`);
          resolve();
        };

        request.onerror = () => {
          console.warn(`⚠️ Failed to save undo history for "${cycleId}"`);
          reject(request.error);
        };
      });
    } catch (e) {
      console.error('❌ IndexedDB write failed:', e);

      // ✅ FIX #11: Handle quota exceeded errors
      if (e.name === 'QuotaExceededError') {
        console.error('💾 Storage quota exceeded - undo history not saved');
        if (Deps.showNotification) {
          Deps.showNotification(
            '⚠️ Storage full - undo history not saved. Consider exporting your data.',
            'warning',
            5000
          );
        }
      }
    }
  }, UNDO_DB_WRITE_DEBOUNCE_MS);
}

/**
 * Load undo/redo stacks from IndexedDB
 */
export async function loadUndoStackFromIndexedDB(cycleId) {
  if (!undoDB) {
    return { undoStack: [], redoStack: [] };  // Graceful degradation
  }
  if (!cycleId) {
    return { undoStack: [], redoStack: [] };
  }

  try {
    return new Promise((resolve) => {
      const transaction = undoDB.transaction(["undoStacks"], "readonly");
      const objectStore = transaction.objectStore("undoStacks");
      const request = objectStore.get(cycleId);

      request.onsuccess = (event) => {
        const data = event.target.result;
        if (data) {
          console.log(`📂 Loaded undo history for "${cycleId}" (${data.undoStack?.length || 0} undo, ${data.redoStack?.length || 0} redo)`);
          resolve({
            undoStack: data.undoStack || [],
            redoStack: data.redoStack || []
          });
        } else {
          console.log(`📂 No undo history found for "${cycleId}" - starting fresh`);
          resolve({ undoStack: [], redoStack: [] });
        }
      };

      request.onerror = () => {
        console.warn(`⚠️ Failed to load undo history for "${cycleId}"`);
        resolve({ undoStack: [], redoStack: [] });
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB read error:', e);
    return { undoStack: [], redoStack: [] };
  }
}

/**
 * Delete undo/redo stacks from IndexedDB
 */
export async function deleteUndoStackFromIndexedDB(cycleId) {
  if (!undoDB) return;
  if (!cycleId) return;

  try {
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");
    const request = objectStore.delete(cycleId);

    // ✅ FIX #11: Properly await IndexedDB operation
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`🗑️ Deleted undo history for "${cycleId}"`);
        resolve();
      };

      request.onerror = () => {
        console.warn(`⚠️ Failed to delete undo history for "${cycleId}"`);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('❌ IndexedDB delete failed:', e);
  }
}

/**
 * Rename cycle's undo/redo stacks in IndexedDB
 */
export async function renameUndoStackInIndexedDB(oldCycleId, newCycleId) {
  if (!undoDB) return;
  if (!oldCycleId || !newCycleId) return;

  try {
    // Load old data
    const oldData = await loadUndoStackFromIndexedDB(oldCycleId);

    // Save under new key
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");

    const newData = {
      cycleId: newCycleId,
      undoStack: oldData.undoStack,
      redoStack: oldData.redoStack,
      lastUpdated: Date.now(),
      version: "1.344"
    };

    // ✅ FIX #11: Properly await IndexedDB operations
    const putRequest = objectStore.put(newData);
    await new Promise((resolve, reject) => {
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    // Delete old key
    const deleteRequest = objectStore.delete(oldCycleId);
    await new Promise((resolve, reject) => {
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });

    console.log(`📝 Renamed undo history: "${oldCycleId}" → "${newCycleId}"`);
  } catch (e) {
    console.error('❌ IndexedDB rename failed:', e);
  }
}

/**
 * Clear all undo history from IndexedDB (factory reset)
 */
export async function clearAllUndoHistoryFromIndexedDB() {
  if (!undoDB) return;

  try {
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    const objectStore = transaction.objectStore("undoStacks");
    const request = objectStore.clear();

    // ✅ FIX #11: Properly await IndexedDB operation
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('🧹 Cleared all undo history from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.warn('⚠️ Failed to clear undo history');
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('⚠️ IndexedDB clear error:', e);
  }
}

// ============ EXPORTS ============

console.log('🔄 UndoRedoManager module loaded');
