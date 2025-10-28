/**
 * miniCycle Undo/Redo Manager Module
 * - State-based undo/redo system with snapshot management
 * - CRITICAL: Cannot work without AppState - fails fast
 * - Pure module with explicit dependency injection
 *
 * @module undoRedoManager
 * @version 1.338
 * @pattern Strict Injection 🔧
 */

import { appInit } from '../appInitialization.js';

// ============ CONSTANTS ============
const UNDO_LIMIT = 50;
const UNDO_MIN_INTERVAL_MS = 300;

// ============ DEPENDENCY INJECTION ============
const Deps = {
  AppState: null,
  refreshUIFromState: null,
  AppGlobalState: null,
  getElementById: null,
  safeAddEventListener: null
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
  if (window.__useUpdateWrapper) {
    console.log('ℹ️ Undo subscriber skipped (wrapper handles snapshots)');
    return;
  }

  try {
    Deps.AppState.subscribe('undo-system', (newState, oldState) => {
      // Runtime guard if wrapper activates later
      if (window.__useUpdateWrapper) return;

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

  // Build minimal signature to detect duplicates
  const sig = JSON.stringify({
    c: snapshot.activeCycleId,
    t: snapshot.tasks.map(t => ({ id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null })),
    ti: snapshot.title,
    ar: !!snapshot.autoReset,
    dc: !!snapshot.deleteCheckedTasks
  });

  const now = Date.now();

  // Throttle identical snapshots
  if (sig === Deps.AppGlobalState.lastSnapshotSignature &&
      now - Deps.AppGlobalState.lastSnapshotTs < UNDO_MIN_INTERVAL_MS) {
    return;
  }

  // Skip if last on stack is identical
  const last = Deps.AppGlobalState.undoStack.at(-1);
  if (last) {
    const lastSig = JSON.stringify({
      c: last.activeCycleId,
      t: (last.tasks || []).map(t => ({ id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null })),
      ti: last.title,
      ar: !!last.autoReset,
      dc: !!last.deleteCheckedTasks
    });
    if (lastSig === sig) return;
  }

  console.log('📸 Capturing snapshot:', {
    taskCount: snapshot.tasks.length,
    title: snapshot.title,
    stackSize: Deps.AppGlobalState.undoStack.length
  });

  Deps.AppGlobalState.undoStack.push(snapshot);
  if (Deps.AppGlobalState.undoStack.length > UNDO_LIMIT) {
    Deps.AppGlobalState.undoStack.shift();
  }

  // Update dedupe trackers
  Deps.AppGlobalState.lastSnapshotSignature = sig;
  Deps.AppGlobalState.lastSnapshotTs = now;

  Deps.AppGlobalState.redoStack = [];
  updateUndoRedoButtons();
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
 * Compare two snapshots for equality
 */
export function snapshotsEqual(a, b) {
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

  if (Deps.AppGlobalState.undoStack.length === 0) {
    console.warn('⚠️ Nothing to undo');
    return;
  }

  if (!Deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  Deps.AppGlobalState.isPerformingUndoRedo = true;
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
    while (Deps.AppGlobalState.undoStack.length) {
      const candidate = Deps.AppGlobalState.undoStack.pop();
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

    Deps.AppGlobalState.redoStack.push(currentSnapshot);

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
    console.log('✅ Undo completed');
  } catch (e) {
    console.error('❌ Undo failed:', e);
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

  if (Deps.AppGlobalState.redoStack.length === 0) {
    console.warn('⚠️ Nothing to redo');
    return;
  }

  if (!Deps.AppState.isReady?.()) {
    console.warn('⚠️ AppState not ready');
    return;
  }

  Deps.AppGlobalState.isPerformingUndoRedo = true;
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
    while (Deps.AppGlobalState.redoStack.length) {
      const candidate = Deps.AppGlobalState.redoStack.pop();
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

    Deps.AppGlobalState.undoStack.push(currentSnapshot);

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
    console.log('✅ Redo completed');
  } catch (e) {
    console.error('❌ Redo failed:', e);
    throw e; // Re-throw so caller knows it failed
  } finally {
    Deps.AppGlobalState.isPerformingUndoRedo = false;
  }
}

// ============ UI UPDATES ============

/**
 * Update undo/redo button states
 */
export function updateUndoRedoButtons() {
  assertInjected('AppGlobalState', Deps.AppGlobalState);

  const undoBtn = Deps.getElementById('undo-btn');
  const redoBtn = Deps.getElementById('redo-btn');
  const undoCount = Deps.AppGlobalState.undoStack.length;
  const redoCount = Deps.AppGlobalState.redoStack.length;

  if (undoBtn) {
    undoBtn.disabled = undoCount === 0;
    undoBtn.hidden = undoCount === 0;
    undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
  }
  if (redoBtn) {
    redoBtn.disabled = redoCount === 0;
    redoBtn.hidden = redoCount === 0;
    redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
  }

  console.log(`🔘 Button states: undo=${undoCount} (hidden=${undoBtn?.hidden}), redo=${redoCount} (hidden=${redoBtn?.hidden})`);
}

// ============ EXPORTS ============

console.log('🔄 UndoRedoManager module loaded');
