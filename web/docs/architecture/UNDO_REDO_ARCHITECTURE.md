# Undo/Redo System Architecture

**Module:** `modules/ui/undoRedoManager.js` (~1,800 lines)
**Version:** See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Test Coverage:** 76/76 tests passing (100%)
**Status:** Production-ready, localStorage cache + IndexedDB persistence

---

## Overview

miniCycle's undo/redo system is a **per-cycle, state-based snapshot system** with **localStorage cache for instant boot** and IndexedDB for persistent storage. Each cycle maintains its own independent undo/redo history, allowing users to undo up to 20 actions per cycle with full state restoration.

### Key Features

- ✅ **Per-cycle isolation** - Each cycle has independent undo/redo history (undo NEVER switches cycles)
- ✅ **Snapshot validation** - Filters out snapshots with wrong cycleId or malformed data
- ✅ **Instant boot via localStorage cache** - Active cycle's history loads synchronously
- ✅ **IndexedDB persistence** - Full history survives page reloads
- ✅ **Dual-write architecture** - localStorage (instant) + IndexedDB (persistent)
- ✅ **Full state snapshots** - Complete cycle state, not deltas
- ✅ **Smart deduplication** - Prevents duplicate snapshots
- ✅ **Throttled capture** - 300ms minimum interval between snapshots
- ✅ **Debounced IndexedDB writes** - Batches writes every 3 seconds
- ✅ **Graceful degradation** - Works in-memory if storage unavailable
- ✅ **Rollback on failure** - Automatic recovery from failed operations
- ✅ **Descriptive notifications** - User-friendly change descriptions
- ✅ **Cross-phase dependency resolution** - Lazy getters for lifecycle hooks

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Actions                            │
│        (add task, edit, complete, reorder, etc.)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 AppState Subscription                       │
│         (Detects changes, triggers snapshot)                │
│                                                             │
│  • Skip if initializing                                    │
│  • Skip if switching cycles                                │
│  • Skip if performing undo/redo                            │
│  • Skip if within 300ms throttle window                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Snapshot Capture & Deduplication               │
│                                                             │
│  1. Build complete state snapshot                          │
│  2. Generate signature for comparison                      │
│  3. Check if duplicate of last snapshot                    │
│  4. Push to in-memory undo stack (max 20)                  │
│  5. Clear redo stack                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Dual-Write Persistence                         │
│                                                             │
│  ┌──────────────────────┐   ┌───────────────────────────┐  │
│  │   localStorage       │   │   IndexedDB (Debounced)   │  │
│  │   Cache (Immediate)  │   │                           │  │
│  │                      │   │   Database: miniCycle...  │  │
│  │   Key: __miniCycle_  │   │   Store: undoStacks       │  │
│  │        undoCache__   │   │   Debounce: 3 seconds     │  │
│  │                      │   │                           │  │
│  │   Active cycle only  │   │   All cycles              │  │
│  │   ~200-400KB max     │   │   Persistent storage      │  │
│  └──────────────────────┘   └───────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cycle Switch Detection                         │
│                                                             │
│  1. Save OLD cycle's stacks to IndexedDB (skip cache)      │
│  2. Clear in-memory stacks, active ID, and cache           │
│  3. Load new cycle's stacks from IndexedDB                 │
│  4. Validate loaded data (filter wrong cycleId/malformed)  │
│  5. Set active ID and populate stacks (after validation)   │
│  6. Update localStorage cache with validated data          │
│  7. Update UI button states                                │
│  8. Wait 300ms, then re-enable snapshot capture            │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Snapshot Structure

Each snapshot captures **complete cycle state** at a point in time:

```javascript
{
  activeCycleId: string,           // Which cycle this snapshot belongs to
  tasks: Task[],                   // Deep cloned task array
  recurringTemplates: object,      // Deep cloned recurring templates
  title: string,                   // Cycle name
  autoReset: boolean,              // Auto-cycle mode
  deleteCheckedTasks: boolean,     // To-do mode
  cycleCount: number,              // Number of completed cycles
  timestamp: number,               // When snapshot was captured
  _sig: string                     // Cached signature for fast comparison
}
```

### IndexedDB Schema

**Database:** `miniCycleUndoHistory` (version 1)
**Object Store:** `undoStacks` (keyPath: `cycleId`)

```javascript
{
  cycleId: string,                 // Primary key
  undoStack: Snapshot[],           // Array of up to 20 snapshots
  redoStack: Snapshot[],           // Array of redo snapshots
  lastUpdated: number,             // Timestamp of last save
  version: string                  // App version (e.g., "1.356")
}
```

### localStorage Cache Structure

**Key:** `__miniCycle_undoCache__`

Stores only the **active cycle's** undo/redo stacks for instant boot:

```javascript
{
  cycleId: string,                 // Which cycle this cache is for
  undoStack: Snapshot[],           // Array of undo snapshots
  redoStack: Snapshot[],           // Array of redo snapshots
  timestamp: number                // When cache was last updated
}
```

**Why localStorage?**
- **Synchronous access** - Loads in <1ms vs 5-10ms for IndexedDB
- **Instant boot** - Buttons show correct state immediately
- **Simple API** - No async/await needed at boot time
- **Small footprint** - Active cycle only (~200-400KB)
- **IndexedDB backup** - Full history still persisted in IndexedDB

### In-Memory State

Stored in `AppGlobalState` (accessed via DI, not window.*):

```javascript
{
  activeUndoStack: [],             // Current cycle's undo snapshots
  activeRedoStack: [],             // Current cycle's redo snapshots
  activeCycleIdForUndo: string,    // Which cycle owns current stacks
  isPerformingUndoRedo: boolean,   // Flag to prevent recursive snapshots
  isSwitchingCycles: boolean,      // Flag to block snapshots during switch
  isInitializing: boolean,         // Flag to skip snapshots during app init
  lastSnapshotSignature: string,   // For deduplication
  lastSnapshotTs: number,          // For throttling
  undoRedoCompletedAt: number      // Grace period timestamp (prevents async render from clearing redo stack)
}
```

---

## Core Operations

### 1. Snapshot Capture

**Triggered by:** AppState subscription on cycle data changes
**Function:** `captureStateSnapshot(state)`
**Throttle:** 300ms minimum interval
**Limit:** 20 snapshots per cycle (oldest discarded)

**Logic Flow:**
1. Check if should skip (initializing, switching, within throttle window)
2. Extract current cycle state
3. Create deep clones of tasks and templates
4. Build compact signature for comparison
5. Check for duplicates (skip if identical to last)
6. Push to undo stack (shift oldest if > 20)
7. Clear redo stack — **only if outside 2-second grace period** after undo/redo (prevents async render side effects from wiping the stack)
8. Update UI button states
9. Save to IndexedDB (debounced)

**What triggers snapshots:**
- Task text changes
- Task completion/incompletion
- Task added/deleted
- Task reordering
- Task priority changes
- Cycle title changes
- Mode changes (autoReset, deleteCheckedTasks)

**What doesn't trigger snapshots:**
- Initial app load
- Cycle switches
- Undo/redo operations themselves
- Changes to other cycles (only active cycle)

### 2. Undo Operation

**Function:** `performStateBasedUndo()`
**Keyboard:** Ctrl+Z (Cmd+Z on Mac)
**Button:** Undo button (hidden if stack empty)

**Critical:** Undo **NEVER** switches cycles. Each routine has isolated undo history. When restoring a snapshot, the cycle ID from `state.appState.activeCycleId` (current cycle) is always used, not `snapshot.activeCycleId`.

**Logic Flow:**
1. Validate: Check stack not empty, AppState ready
2. Create rollback points (in case of failure)
3. Set `isPerformingUndoRedo` flag
4. Capture current state as snapshot
5. Pop from undo stack (skip duplicates)
6. Push current state to redo stack
7. Restore snapshot to AppState **using current cycle ID** (not snapshot's)
8. Refresh UI from restored state
9. Update button states
10. Save updated stacks to IndexedDB
11. Show success notification with change description
12. Set `undoRedoCompletedAt` timestamp (grace period for async render)
13. On error: Rollback to saved state

**Example notifications:**
- "↩️ Undone: Task added (3 steps left)"
- "↩️ Undone: 2 tasks completed (no steps left)"
- "↩️ Undone: Mode changed (5 steps left)"

### 3. Redo Operation

**Function:** `performStateBasedRedo()`
**Keyboard:** Ctrl+Y or Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
**Button:** Redo button (hidden if stack empty)

**Logic Flow:**
(Identical to undo but with stacks reversed)

### 4. Cycle Switching

**Function:** `onCycleSwitched(newCycleId)`
**Called by:** `routineSwitcher` module when user switches cycles
**Dependency Resolution:** Lazy getter in `moduleLoader.js` (resolves at runtime, not initialization)

**Logic Flow:**
1. Check if actually changing cycles (skip if same cycle)
2. Set `isSwitchingCycles` flag to block snapshots
3. Save OLD cycle's stacks to IndexedDB (with `skipCache: true`)
4. **Clear EVERYTHING first:**
   - Clear in-memory undo stack
   - Clear in-memory redo stack
   - Clear `activeCycleIdForUndo`
   - Clear localStorage cache
5. Load new cycle's stacks from IndexedDB
6. **Validate loaded data** (filter out wrong cycleId or malformed snapshots)
7. **THEN set active ID and populate stacks** (after validation completes)
8. Update localStorage cache with validated data
9. Update UI button states
10. Wait 300ms for cycle to fully load
11. Clear `isSwitchingCycles` flag

**Important:**
- The 300ms delay ensures the new cycle's data is fully loaded before re-enabling snapshot capture, preventing corruption.
- Validation MUST complete before populating stacks to prevent mixed-cycle data.
- The `skipCache` option prevents the OLD cycle's data from being written to cache during the transition.

**Cross-Phase Dependency:**
`routineSwitcher` loads in PHASES.CYCLE (5), but `undoRedoManager` loads in PHASES.UI_MANAGERS (6). To resolve this, `moduleLoader.js` provides lazy getters that resolve at runtime:

```javascript
// In moduleLoader.js buildModuleDependencies()
onCycleSwitched: (...args) => deps.ui?.onCycleSwitched?.(...args),
onCycleDeleted: (...args) => deps.ui?.onCycleDeleted?.(...args),
onCycleRenamed: (...args) => deps.ui?.onCycleRenamed?.(...args),
```

This allows `routineSwitcher` to call these functions after both modules have loaded.

---

## Snapshot Validation

To ensure per-cycle isolation and prevent data corruption, snapshots are validated before use.

### Validation Functions

```javascript
/**
 * Validate a single snapshot belongs to the expected cycle
 */
function validateSnapshot(snapshot, expectedCycleId) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (!snapshot.activeCycleId) return false;
  if (snapshot.activeCycleId !== expectedCycleId) return false;
  if (!Array.isArray(snapshot.tasks)) return false;
  return true;
}

/**
 * Filter snapshots to only include those belonging to the specified cycle
 */
function filterValidSnapshots(snapshots, cycleId) {
  if (!Array.isArray(snapshots)) return [];
  if (!cycleId) return [];

  const valid = snapshots.filter(snap => validateSnapshot(snap, cycleId));
  const removed = snapshots.length - valid.length;

  if (removed > 0) {
    console.warn(`Filtered out ${removed} invalid snapshots (wrong cycleId or malformed)`);
  }

  return valid;
}
```

### When Validation Occurs

1. **On cycle switch** - Loaded stacks are validated before populating in-memory state
2. **On cache load** - localStorage cache is validated before use
3. **On snapshot capture** - Cycle mismatch check prevents capturing for wrong cycle

### Why Validation Matters

Without validation, these issues could occur:
- **Mixed-cycle data** - Snapshots from different cycles in the same stack
- **Undo switching cycles** - Restoring a snapshot could change the active cycle
- **Corrupted cache** - Stale cache data could pollute fresh cycle loads

---

## Deduplication & Performance

### Signature Generation

To avoid storing duplicate snapshots, each snapshot gets a compact signature:

```javascript
function buildSnapshotSignature(snapshot) {
  return JSON.stringify({
    c: snapshot.activeCycleId,
    t: snapshot.tasks.map(t => ({
      id: t.id,
      txt: t.text,
      c: !!t.completed,
      p: !!t.highPriority,
      d: t.dueDate || null
    })),
    ti: snapshot.title || '',
    ar: !!snapshot.autoReset,
    dc: !!snapshot.deleteCheckedTasks,
    cc: snapshot.cycleCount || 0
  });
}
```

**Cached Signatures:**
Signatures are cached on snapshot objects (`_sig` property) to avoid recomputing on every comparison.

### Throttling Strategy

**300ms minimum interval** between snapshots prevents spam:
- Rapid task completions → Only last state captured
- Drag reordering → Only final position captured
- Batch operations → Single snapshot

### Debounced IndexedDB Writes

**3-second debounce** on IndexedDB writes:
- Multiple snapshots → Single database write
- Reduces I/O overhead
- Force-saves on page unload (beforeunload handler)

---

## Lifecycle Integration

### App Initialization

**Function:** `initUndoSystemForApp()`
**Called:** During app startup after AppState ready

**Steps:**
1. Get current active cycle ID from AppState
2. **Try localStorage cache first** (synchronous, instant!)
   - If cache hit: Populate in-memory stacks immediately
   - If cache miss: Initialize empty stacks
3. Update UI button states (instant with cache!)
4. **Background:** Initialize IndexedDB connection
5. **Background:** If cache miss, load from IndexedDB and update stacks
6. **Background:** Update localStorage cache for next boot
7. Set up `beforeunload` handler for force-save (both cache + IndexedDB)

**Boot Performance:**
- **With cache (typical):** <1ms for undo system initialization
- **Without cache (first boot):** 5-10ms for IndexedDB load

### Cycle Creation

**Function:** `onCycleCreated(cycleId)`
**Called by:** `routineManager` when new cycle created

**Action:** Initialize empty undo/redo stacks in IndexedDB for new cycle

### Cycle Deletion

**Function:** `onCycleDeleted(cycleId)`
**Called by:** `routineManager` when cycle deleted

**Action:**
- Remove cycle's undo history from IndexedDB
- Clear in-memory stacks if this was active cycle
- **Clear localStorage cache** if this was active cycle

### Cycle Rename

**Function:** `onCycleRenamed(oldCycleId, newCycleId)`
**Called by:** `routineSwitcher` when cycle renamed

**Action:**
- Load undo history under old key
- Save under new key
- Delete old key
- Update in-memory tracking

### Clear Undo History (Settings Button)

**Function:** `clearAllUndoHistory()`
**Called by:** Settings → Reset Options → Clear Undo History
**DI Wiring:** `settingsUIManager` → `settingsManager` (facade) → `depMappings` → `undoRedoManager`

**Action — clears all three tiers with guards against snapshot recapture:**

1. **Cancel pending IndexedDB write** — clears `dbWriteTimeout` to prevent a debounced write from re-saving old data after the clear
2. **Set `isPerformingUndoRedo` guard** — blocks the AppState wrapper from capturing new snapshots during cleanup (the caller's `AppState.update()` to zero `undoSizeBytes` would otherwise trigger a fresh snapshot)
3. **Clear in-memory stacks** — empties `activeUndoStack` and `activeRedoStack` in AppGlobalState
4. **Reset dedup trackers** — sets `lastSnapshotSignature = null` and `lastSnapshotTs = 0` so the next real user action gets captured fresh
5. **Clear localStorage cache** — calls `clearUndoCache()` to remove `__miniCycle_undoCache__`
6. **Clear IndexedDB** — calls `clearAllUndoHistoryFromIndexedDB()` to wipe the `undoStacks` object store
7. **Update UI** — calls `updateUndoRedoButtons()` to hide undo/redo buttons
8. **Release guard** — uses `setTimeout(0)` to clear `isPerformingUndoRedo` after the caller's synchronous `AppState.update()` has completed

**Why the guard is needed:**
The settings button handler calls `clearAllUndoHistory()` then immediately calls `AppState.update()` to zero out `undoSizeBytes` in cycle state. Without the `isPerformingUndoRedo` guard, the AppState wrapper would treat that update as a user action and capture a fresh snapshot into the just-cleared cache — defeating the clear.

### Factory Reset

**Functions:**
- `clearAllUndoHistoryFromIndexedDB()` - Clears IndexedDB
- `clearUndoCache()` - Clears localStorage cache
**Called by:** Settings → Factory Reset (uses low-level functions directly)

**Action:**
- Clear entire `undoStacks` object store in IndexedDB
- Clear localStorage cache (`__miniCycle_undoCache__`)

---

## Change Detection & Descriptions

The system analyzes what changed between snapshots to show user-friendly notifications:

```javascript
function describeChange(fromSnapshot, toSnapshot) {
  // Checks in priority order:
  // 1. Cycle renamed
  // 2. Mode changed (autoReset or deleteCheckedTasks)
  // 3. Tasks added/deleted (with count)
  // 4. Task text edited
  // 5. Tasks completed/uncompleted (with count)
  // 6. Tasks reordered
  // 7. Priority changed
  // 8. Generic "Change" fallback
}
```

**Examples:**
- "Task added"
- "3 tasks deleted"
- "Task edited"
- "2 tasks completed"
- "Tasks reordered"
- "Priority changed"
- "Cycle renamed"
- "Mode changed"

---

## Error Handling & Safety

### Rollback on Failure

Both undo and redo operations create rollback points before modifying state:

```javascript
try {
  // Perform undo/redo
} catch (e) {
  // Rollback to saved state
  await AppState.set(rollbackState);
  AppGlobalState.activeUndoStack = rollbackUndoStack;
  AppGlobalState.activeRedoStack = rollbackRedoStack;
  showNotification('⚠️ Undo failed - state restored', 'error');
  throw e;
}
```

### Graceful Degradation

If IndexedDB is unavailable (private browsing, browser limitations):
- System continues working in-memory only
- History lost on page reload
- No errors thrown
- User can still undo within current session

### Force-Save on Page Unload

A `beforeunload` handler ensures unsaved changes are written:

```javascript
window.addEventListener('beforeunload', () => {
  // Clear debounce timer
  if (dbWriteTimeout) {
    clearTimeout(dbWriteTimeout);
  }

  // Force immediate synchronous write
  // (No await - must complete before unload)
  const transaction = undoDB.transaction(["undoStacks"], "readwrite");
  // ... save current stacks ...
});
```

---

## Testing Strategy

**Test Suite:** `tests/undoRedoManager.tests.js` (73 tests, 100% passing)

### Test Categories

1. **Initialization Tests** (7 tests)
   - Module creation and dependency injection
   - Button initialization
   - IndexedDB setup

2. **Snapshot Capture Tests** (12 tests)
   - Basic snapshot creation
   - Deduplication
   - Throttling
   - Stack size limits

3. **Undo/Redo Operations** (15 tests)
   - Basic undo/redo
   - Multiple operations
   - Duplicate skipping
   - Stack boundaries
   - Error handling

4. **Cycle Lifecycle Tests** (10 tests)
   - Cycle switching
   - Cycle creation
   - Cycle deletion
   - Cycle rename

5. **IndexedDB Persistence Tests** (12 tests)
   - Save/load operations
   - Cycle-specific storage
   - Database cleanup
   - Migration operations

6. **Change Detection Tests** (8 tests)
   - Signature generation
   - Description generation
   - Comparison accuracy

7. **Integration Tests** (9 tests)
   - AppState integration
   - UI updates
   - Keyboard shortcuts
   - Notification display

### Test Patterns

**localStorage Protection:**
Tests save and restore user data before/after each test:

```javascript
let savedRealData = {};
before(() => {
  const protectedKeys = ['miniCycleData'];
  protectedKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) savedRealData[key] = value;
  });
});

after(() => {
  Object.keys(savedRealData).forEach(key => {
    localStorage.setItem(key, savedRealData[key]);
  });
});
```

**IndexedDB Mocking:**
Tests use mock IndexedDB implementations to avoid polluting real database.

---

## Performance Characteristics

### Boot Performance

- **With localStorage cache (typical):** <1ms for undo initialization
- **Without cache (first boot):** 5-10ms for IndexedDB load
- **Cache hit rate:** ~99% (only miss on first boot or cycle switch)

### Memory Usage

- **Per-cycle overhead:** ~5-20KB depending on task count
- **20 snapshots max:** Prevents unbounded growth
- **Deep clones:** Uses `structuredClone()` for safety
- **localStorage cache:** ~200-400KB for active cycle

### Storage Performance

- **localStorage writes:** Immediate (<1ms)
- **IndexedDB write debouncing:** Reduces writes by ~90%
- **Read caching:** Stacks cached in memory
- **Async IndexedDB:** Non-blocking UI

### Throttling Impact

- **300ms minimum:** Prevents snapshot spam
- **Worst case:** One snapshot per 300ms (3.3/second)
- **Typical usage:** 1-5 snapshots per minute

---

## Known Limitations

1. **Not cross-device** - Undo history is device-local (no sync)
2. **20 snapshot limit** - Older changes are lost
3. **Full snapshots** - Not delta-based (more memory)
4. **No undo for cycle deletion** - Cycle must be restored via import
5. **Browser storage limits** - IndexedDB quota varies by browser

---

## Future Enhancements

Potential improvements (not currently planned):

1. **Delta-based snapshots** - Store only changes, not full state
2. **Configurable limits** - Let users choose undo depth
3. **Undo across cycles** - Cross-cycle undo history
4. **Cloud sync** - Sync undo history across devices
5. **Visual timeline** - Show undo history with previews
6. **Selective undo** - Undo specific changes out of order

---

## API Reference

### Initialization

```javascript
// Set dependencies (called by main app)
setUndoRedoManagerDependencies({
  AppState,
  refreshUIFromState,
  AppGlobalState,
  getElementById,
  safeAddEventListener,
  showNotification
});

// Initialize system
await initUndoSystemForApp();

// Wire UI buttons
wireUndoRedoUI();

// Set up AppState subscription
setupStateBasedUndoRedo();
```

### Core Operations

```javascript
// Manual snapshot capture
captureStateSnapshot(state);

// Perform operations
await performStateBasedUndo();
await performStateBasedRedo();

// Update UI
updateUndoRedoButtons();
```

### Lifecycle Hooks

```javascript
// Cycle events
await onCycleSwitched(newCycleId);
await onCycleCreated(cycleId);
await onCycleDeleted(cycleId);
await onCycleRenamed(oldCycleId, newCycleId);

// Enable on first interaction
enableUndoSystemOnFirstInteraction();
```

### Clear & Reset

```javascript
// Clear ALL undo history (in-memory + localStorage + IndexedDB)
// Used by Settings → Clear Undo History button
await clearAllUndoHistory();

// Low-level clear functions (used by factory reset)
clearUndoCache();                        // localStorage only
await clearAllUndoHistoryFromIndexedDB(); // IndexedDB only
```

### Utilities

```javascript
// Snapshot comparison
const equal = snapshotsEqual(snapshot1, snapshot2);

// Signature generation
const sig = buildSnapshotSignature(snapshot);

// Change description
const desc = describeChange(fromSnapshot, toSnapshot);

// Snapshot validation
const isValid = validateSnapshot(snapshot, expectedCycleId);
const validSnapshots = filterValidSnapshots(snapshots, cycleId);
```

---

## Debugging Tips

### Enable Verbose Logging

The module logs extensively to console:
- 📸 Snapshot capture
- 💾 IndexedDB saves
- 📂 IndexedDB loads
- 🔄 Cycle switches
- ↩️ Undo operations
- ↪️ Redo operations

### Check IndexedDB State

```javascript
// Open DevTools → Application → IndexedDB → miniCycleUndoHistory
// Inspect undoStacks object store
// Each entry shows cycleId, undoStack[], redoStack[]
```

### Check In-Memory State

```javascript
// In browser console (use versioned import for cache-busting):
let _ags;
import('/modules/core/appGlobalState.js?v=1.677').then(m => _ags = m.AppGlobalState);

// Then inspect:
_ags.activeUndoStack
_ags.activeRedoStack
_ags.activeCycleIdForUndo
```

### Check localStorage Cache

```javascript
// In browser console:
const cache = localStorage.getItem('__miniCycle_undoCache__');
console.log(JSON.parse(cache));
```

### Common Issues

**Snapshots not captured:**
- Check `isInitializing` flag (should be false after first interaction)
- Check `isSwitchingCycles` flag (should be false)
- Check throttle window (300ms between snapshots)
- Check for cycle mismatch (snapshot's cycleId must match activeCycleIdForUndo)

**History not persisting:**
- Check IndexedDB available (`undoDB` should not be null)
- Check browser storage quota
- Check for private browsing mode

**Wrong cycle's history:**
- Check `activeCycleIdForUndo` matches current cycle
- Verify cycle switch completed (`isSwitchingCycles` should be false)
- Check localStorage cache cycleId matches active cycle
- Look for "Filtered out X invalid snapshots" warnings in console

**Cache not updating on cycle switch:**
- Verify `onCycleSwitched` is being called (check for "Switching undo context" log)
- Check that lazy getter in moduleLoader.js is resolving correctly
- Ensure undoRedoManager loaded before cycle switch occurs

**Redo button appears briefly then disappears after undo:**
- This was caused by async `renderTasks()` triggering `AppState.update()` after `isPerformingUndoRedo` was cleared in the `finally` block
- The wrapper treated these render-triggered updates as user actions and cleared the redo stack
- Fix: A 2-second grace period (`undoRedoCompletedAt` timestamp) prevents `activeRedoStack = []` from executing shortly after undo/redo completes
- Additionally, `UIOrchestrator.flush()` is called after `request()` in `handleUndoRedoUIUpdate` to force synchronous render start while the flag is still active

**onCycleSwitched not being called:**
- This can happen if routineSwitcher (phase 5) tries to call before undoRedoManager (phase 6) loads
- Solution: Lazy getters in moduleLoader.js resolve at runtime, not initialization
- Check console for "Cleared undo stack, active ID, and cache" log after switching

**Clear Undo History button does nothing (fixed March 2026):**
- Root cause: `clearAllUndoHistory` was in the manifest's `provides` and the consumer's `optionalDeps`, but missing from `depMappings` in `moduleLoader.js`
- `_deps.clearAllUndoHistory?.()` in `settingsUIManager` silently returned `undefined` — optional chaining masked the missing wiring
- Fix: Added `clearAllUndoHistory` entry to `depMappings` in `moduleLoader.js`
- Secondary fix: Added `isPerformingUndoRedo` guard to `clearAllUndoHistory()` to prevent the caller's `AppState.update()` from recapturing a snapshot into the freshly-cleared cache
- Diagnostic: Patch `localStorage.removeItem` to log calls — if zero removes during clear, the function was never called (wiring issue)
- See `MAKING_CODE_CHANGES.md` Step 4 checklist for preventing this class of bug

---

## Related Documentation

- **[TESTING_QUICK_REFERENCE.md](../testing/TESTING_QUICK_REFERENCE.md)** - Test suite guide
- **[DEVELOPER_DOCUMENTATION.md](../developer-guides/DEVELOPER_DOCUMENTATION.md)** - Overall architecture
- **[SCHEMA_2_5.md](../data-schema/SCHEMA_2_5.md)** - Data structure details

---

**Last Updated:** March 7, 2026
**Module Version:** See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Test Status:** 76/76 passing ✅
**Architecture:** localStorage cache + IndexedDB dual-write, per-cycle isolation with validation
