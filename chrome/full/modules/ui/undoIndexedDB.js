/**
 * miniCycle Undo IndexedDB Module (DI-Pure)
 *
 * Durable per-cycle persistence for undo/redo history. Split out of
 * `undoRedoManager.js` (Priority 3, LARGE_MODULE_SPLITS_PLAN.md), which owned
 * twelve responsibilities in one file.
 *
 * WHY THIS SEAM: it is the only cluster in that module that owns its own state.
 * `undoDB` (the connection handle) and `dbWriteTimers` (the per-cycle write
 * debounce) are read and written by nothing else, so moving the functions moves
 * the state with them and leaves no shared mutable surface behind. The snapshot
 * cluster was measured at the same time and deliberately left in place: it calls
 * back into parent UI and into this module, so its seam is genuinely wider.
 *
 * PATTERN: static import from the parent, matching `notifications.js` ->
 * `educationalTips.js` rather than the dynamic Pattern-1 facades. The parent is
 * a set of exported functions with no async init to hang a dynamic import on,
 * and these functions are called from synchronous paths (including the
 * `beforeunload` flush) where awaiting an import is not an option.
 *
 * CONSEQUENCE: a static import from a boot-critical module makes this file
 * boot-critical too. It IS listed in `BOOT_CRITICAL` in `service-worker.js`;
 * run `npm run test:sw` if you touch it, because no other gate covers that.
 *
 * The parent RE-EXPORTS `initUndoIndexedDB` and `closeUndoIndexedDB` because
 * both are named in this module's `provides` list in `moduleManifests.js`.
 * `registerProvides` silently SKIPS a name it cannot find on the module, which
 * is how the v2.347 statsPanel split broke three-panel swipe for forty
 * releases. `validate:provides` now gates exactly that.
 *
 * @module ui/undoIndexedDB
 */

import { createDIModule, required } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';
import { DEBOUNCE, APP_VERSION, UI_TIMEOUTS } from '../core/constants.js';

const UNDO_DB_WRITE_DEBOUNCE_MS = DEBOUNCE.UNDO_DB_WRITE;

/**
 * All three are required: this module cannot do its job without any of them, so
 * they are read unguarded. A `?.` here would create a branch that only fires
 * when wiring is broken and would then silently drop history writes
 * (`validate:chains` gates this).
 *
 * - `showNotification`        user-facing quota/write failures
 * - `saveToUndoCache`         the localStorage instant-boot mirror, owned by the parent
 * - `relabelSnapshotsForCycle` snapshot rewriting on rename, shared with the parent's
 *                              `onCycleRenamed`, so it stays there rather than being duplicated
 */
const di = createDIModule('UndoIndexedDB', {
  showNotification: required(),
  saveToUndoCache: required(),
  relabelSnapshotsForCycle: required()
});

/** @type {{showNotification: Function, saveToUndoCache: Function, relabelSnapshotsForCycle: Function}} */
const _deps = new Proxy({}, {
  get(target, prop) {
    return di.resolve()[prop];
  },
  set() {
    return false;
  }
});

/**
 * Inject dependencies. Called by the parent from
 * `setUndoRedoManagerDependencies()` so the two stay wired together.
 * @param {Object} [overrides]
 * @returns {void}
 */
export function setUndoIndexedDBDependencies(overrides = {}) {
  di.setDependencies(overrides);
}

// ── Owned state ─────────────────────────────────────────────────────────────
// Private to this module by design. Everything that needs to touch it goes
// through an exported function below; that is what made this seam narrow.

let undoDB = null;  // Database connection

/**
 * Pending debounced writes, keyed by cycleId: { timer, undoSnap, redoSnap }.
 * Per-cycle rather than a single timer so a fast switch between routines cannot
 * cancel the previous routine's scheduled write.
 */
const dbWriteTimers = new Map();

/**
 * Cancel a cycle's pending debounced IndexedDB write, if any. Used on
 * delete/rename so a late write can't recreate the deleted record or misfile
 * the renamed one.
 * @param {string} cycleId
 */
export function cancelPendingDbWrite(cycleId) {
  const entry = dbWriteTimers.get(cycleId);
  if (entry) {
    clearTimeout(entry.timer);
    dbWriteTimers.delete(cycleId);
  }
}


/**
 * Initialize IndexedDB for undo history persistence
 * Gracefully degrades if IndexedDB unavailable (private browsing)
 */
export async function initUndoIndexedDB() {
  try {
    return new Promise((resolve, reject) => {
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn('⚠️ initUndoIndexedDB timed out');
        undoDB = null;
        resolve(false);
      }, 5000);

      const request = indexedDB.open("miniCycleUndoHistory", 1);

      request.onerror = () => {
        clearTimeout(timeout);
        console.warn('⚠️ IndexedDB unavailable - undo limited to session only');
        undoDB = null;
        resolve(false);
      };

      request.onsuccess = (event) => {
        clearTimeout(timeout);
        undoDB = event.target.result;
        resolve(true);
      };

      request.onblocked = () => {
        clearTimeout(timeout);
        console.warn('⚠️ IndexedDB blocked - undo limited to session only');
        undoDB = null;
        resolve(false);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains("undoStacks")) {
          const objectStore = db.createObjectStore("undoStacks", { keyPath: "cycleId" });
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
 * Close the undo IndexedDB connection and drop every pending debounced write.
 *
 * Factory reset calls this BEFORE deleting the databases. An open connection
 * makes `indexedDB.deleteDatabase` fire `onblocked` instead of deleting, and the
 * reset's handler settles on `blocked` and carries on — so the user was told
 * "Factory reset complete" while miniCycleUndoHistory was still there, with a
 * delete request left pending that then blocks every later open of it. Pending
 * debounced writes are cancelled too: one firing after the delete would recreate
 * the database with pre-reset stacks in it.
 *
 * Safe to call repeatedly, and `initUndoIndexedDB()` reopens afterwards — that
 * pair is what lets factory reset run more than once without a page reload.
 * @returns {void}
 */
export function closeUndoIndexedDB() {
  dbWriteTimers.forEach((entry) => clearTimeout(entry.timer));
  dbWriteTimers.clear();

  try {
    undoDB?.close();
  } catch (e) {
    console.warn('⚠️ Failed to close undo IndexedDB connection:', e);
  }
  undoDB = null;
}


/**
 * Save undo/redo stacks to both localStorage cache (immediate) and IndexedDB (debounced)
 */
export function saveUndoStackToIndexedDB(cycleId, undoStack, redoStack, options = {}) {
  if (!cycleId) return;

  // Save to localStorage cache unless explicitly skipped (e.g., during cycle switching)
  if (!options.skipCache) {
    _deps.saveToUndoCache(cycleId, undoStack, redoStack);
  }

  // Graceful degradation if IndexedDB unavailable
  if (!undoDB) return;

  // Snapshot the arrays at CALL time. captureStateSnapshot mutates the live
  // stack in place (push/shift), so serializing at fire time could otherwise
  // persist a state that no longer matches this call. (Belt-and-suspenders — the
  // cross-cycle switch path reassigns, but a copy is cheap and removes the class.)
  const undoSnap = Array.isArray(undoStack) ? [...undoStack] : [];
  const redoSnap = Array.isArray(redoStack) ? [...redoStack] : [];

  // Debounce IndexedDB writes PER CYCLE (see dbWriteTimers) — only cancel this
  // cycle's own pending write, never another cycle's.
  cancelPendingDbWrite(cycleId);

  const timer = setTimeout(async () => {
    dbWriteTimers.delete(cycleId);
    try {
      const transaction = undoDB.transaction(["undoStacks"], "readwrite");
      const objectStore = transaction.objectStore("undoStacks");

      const data = {
        cycleId,
        undoStack: undoSnap,
        redoStack: redoSnap,
        lastUpdated: Date.now(),
        version: APP_VERSION
      };

      const request = objectStore.put(data);

      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.warn(`⚠️ Failed to save undo history for "${cycleId}"`);
          reject(request.error);
        };
      });
    } catch (e) {
      console.error('❌ IndexedDB write failed:', e);

      if (e.name === 'QuotaExceededError') {
        console.error('💾 Storage quota exceeded - undo history not saved');
        if (_deps.showNotification) {
          _deps.showNotification(
            '⚠️ ' + getLabel('notify.undoStorageFull'),
            'warning',
            UI_TIMEOUTS.NOTIFICATION_SLOW
          );
        }
      }
    }
  }, UNDO_DB_WRITE_DEBOUNCE_MS);

  dbWriteTimers.set(cycleId, { timer, undoSnap, redoSnap });
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
      // Timeout to prevent indefinite hangs
      const timeout = setTimeout(() => {
        console.warn(`⚠️ loadUndoStackFromIndexedDB timed out for "${cycleId}"`);
        resolve({ undoStack: [], redoStack: [] });
      }, 5000);

      const transaction = undoDB.transaction(["undoStacks"], "readonly");
      const objectStore = transaction.objectStore("undoStacks");
      const request = objectStore.get(cycleId);

      request.onsuccess = (event) => {
        clearTimeout(timeout);
        const data = event.target.result;
        if (data) {
          resolve({
            undoStack: data.undoStack || [],
            redoStack: data.redoStack || []
          });
        } else {
          resolve({ undoStack: [], redoStack: [] });
        }
      };

      request.onerror = () => {
        clearTimeout(timeout);
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

    // Wrap the callback-based request so callers actually await completion
    // and failures reach the error boundary
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
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

    // Relabel every snapshot, not just the storage key — snapshots embed
    // activeCycleId and title (key=title in this app). A verbatim copy left
    // each one carrying the OLD id, so validateSnapshot's strict-equality
    // check rejected the entire migrated history on the next filtered load
    // (silent total wipe), and any snapshot that DID survive an unfiltered
    // path would restore the old title into the renamed cycle on Undo,
    // breaking the key=title invariant.
    const newData = {
      cycleId: newCycleId,
      undoStack: _deps.relabelSnapshotsForCycle(oldData.undoStack, newCycleId),
      redoStack: _deps.relabelSnapshotsForCycle(oldData.redoStack, newCycleId),
      lastUpdated: Date.now(),
      version: APP_VERSION
    };

    // Wrap the callback-based request so callers actually await completion
    // and failures reach the error boundary
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

    // Wrap the callback-based request so callers actually await completion
    // and failures reach the error boundary
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
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


// ── Exports for callers that used to reach into the state directly ──────────
// Before the split, `initUndoSystemForApp`, `clearAllUndoHistory` and
// `destroyUndoRedoManager` manipulated `dbWriteTimers` and `undoDB` inline.
// These three functions are that access, named.

/**
 * Synchronously flush EVERY pending debounced write.
 *
 * Called from the parent's `beforeunload` / `pagehide` / `visibilitychange`
 * handler. Flushes all cycles, not just the active one, so a fast
 * switch-then-close cannot drop a scheduled write. Synchronous on purpose:
 * the page is going away and an awaited write would not complete.
 * @returns {void}
 */
export function flushPendingWritesSync() {
  dbWriteTimers.forEach((entry, cid) => {
    clearTimeout(entry.timer);
    if (undoDB && cid) {
      try {
        const tx = undoDB.transaction(["undoStacks"], "readwrite");
        tx.objectStore("undoStacks").put({
          cycleId: cid,
          undoStack: entry.undoSnap,
          redoStack: entry.redoSnap,
          lastUpdated: Date.now(),
          version: APP_VERSION
        });
      } catch (e) {
        console.warn('⚠️ Failed to flush pending undo write:', e);
      }
    }
  });
  dbWriteTimers.clear();
}

/**
 * Synchronously write one cycle's stacks, bypassing the debounce.
 *
 * The unload counterpart to `saveUndoStackToIndexedDB`: same payload shape, no
 * timer, no await. Silent no-op when there is no open connection or no cycle.
 * @param {string} cycleId
 * @param {Array} undoStack
 * @param {Array} redoStack
 * @returns {void}
 */
export function forceSaveStackSync(cycleId, undoStack, redoStack) {
  if (!cycleId || !undoDB) return;
  try {
    const transaction = undoDB.transaction(["undoStacks"], "readwrite");
    transaction.objectStore("undoStacks").put({
      cycleId,
      undoStack,
      redoStack,
      lastUpdated: Date.now(),
      version: APP_VERSION
    });
  } catch (e) {
    console.warn('⚠️ Failed to force-save undo history:', e);
  }
}

/**
 * Cancel every pending debounced write WITHOUT writing it.
 *
 * The opposite of `flushPendingWritesSync`, and used where the data is being
 * discarded anyway: clearing all history, and module teardown. Dropping this
 * call lets a scheduled timer resurrect history the user just cleared.
 * @returns {void}
 */
export function cancelAllPendingWrites() {
  dbWriteTimers.forEach(entry => clearTimeout(entry.timer));
  dbWriteTimers.clear();
}
