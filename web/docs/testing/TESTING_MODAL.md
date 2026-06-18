# Testing Modal

> **In-app test runner with automatic data protection**

The testing modal allows running the full test suite from within the miniCycle app itself, with built-in protection for user data during test execution.

---

## Quick Start

1. Open **Settings** (gear icon)
2. Scroll to **Developer Options** section
3. Click **"Open Testing Modal"**
4. Click **"Run All Tests"**

Tests run in an embedded iframe while a progress modal shows status.

---

## How It Works

### Test Execution Flow

```
User clicks "Run All Tests"
        ↓
┌─────────────────────────────────┐
│ 1. Force save AppState          │ ← Ensures all pending changes are saved
│ 2. Create test backup           │ ← BackupManager saves recoverable copy
│ 3. Backup localStorage          │ ← Protected keys (__miniCycle_*)
│ 4. Set test mode flag           │ ← Pauses AppState saves
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│ Open iframe: module-test-suite  │
│ with ?autorun=true&embedded=true│
└─────────────────────────────────┘
        ↓
    Tests run (full suite)
        ↓
┌─────────────────────────────────┐
│ iframe sends TEST_RESULTS       │
│ via postMessage                 │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│ 1. Clear test mode flag         │ ← Resume AppState saves
│ 2. AppState.reload()            │ ← Sync in-memory with localStorage
│ 3. Clear backup flags           │
│ 4. Display results              │
└─────────────────────────────────┘
```

### Data Protection System

The testing modal protects user data through multiple layers that work together.

---

## BackupManager: The Full Backup System

miniCycle has a comprehensive backup system managed by `BackupManager` that stores backups in IndexedDB. The testing modal integrates with this system.

### Backup Types

| Type | When Created | Max Kept | Min Interval | Purpose |
|------|--------------|----------|--------------|---------|
| **Session** | Every app open | 5 | 5 minutes | Quick recovery from recent sessions |
| **Auto** | Background | 10 | 24 hours | Daily snapshots |
| **Test** | Before "Run All Tests" | 5 | 5 minutes | Recovery if tests corrupt data |
| **Manual** | User-initiated | 50 | None | User-controlled checkpoints |

### Session Backups (On App Open)

Every time the app opens, a session backup is created (if > 5 min since last):

```javascript
// Called during boot in coreBoot.js
await backupManager.createSessionBackup();
```

This captures your data state before any changes in the current session.

### Auto Backups (Every 24 Hours)

Automatic daily backups run in the background:

```javascript
// Called during boot
await backupManager.createAutoBackup();
// Skips if last backup was < 24 hours ago
```

### Test Backups (Before Running Tests)

When you click "Run All Tests", a test backup is created:

```javascript
// In testing-modal-integration.js
const backupManager = getBackupManager();
await backupManager.createTestBackup();
```

These appear in **Settings > Restore Backups** for manual recovery.

---

## Flag System: Coordinating Test Mode

The flag system coordinates between the testing modal, test suite, and AppState to prevent data corruption.

### The Test Mode Flag (`__miniCycle_testModeActive__`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLAG LIFECYCLE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks "Run All Tests"                                 │
│     ↓                                                           │
│  2. SET FLAG: localStorage.setItem('__miniCycle_testModeActive__', 'true')
│     ↓                                                           │
│  3. Tests run in iframe (can modify localStorage freely)        │
│     ↓                                                           │
│  4. During tests: AppState.scheduleSave() checks flag           │
│     → if (flag === 'true') skip save                            │
│     ↓                                                           │
│  5. Tests complete, localStorage restored by test suite         │
│     ↓                                                           │
│  6. CLEAR FLAG: localStorage.removeItem('__miniCycle_testModeActive__')
│     ↓                                                           │
│  7. AppState.reload() syncs in-memory state with localStorage   │
│     ↓                                                           │
│  8. Normal saves resume                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### How AppState Uses the Flag

In `appState.js`, the `scheduleSave()` method checks the flag:

```javascript
scheduleSave(immediate = false) {
    // Skip saves during test runs to prevent overwriting restored data
    if (localStorage.getItem('__miniCycle_testModeActive__') === 'true') {
        console.log('Save skipped - tests running');
        return;
    }
    // ... normal save logic
}
```

This prevents the debounced save system from writing test data to localStorage.

### IndexedDB Backup (in module-test-suite.html)

The test suite backs up localStorage to IndexedDB before tests run:

```javascript
// In module-test-suite.html - backupLocalStorageToIndexedDB()
const backup = {};
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
        backup[key] = localStorage.getItem(key);
    }
}
// Stored in IndexedDB 'miniCycleTestResultsDB', record id: 'preTestBackup'
store.put({
    id: 'preTestBackup',
    localStorageBackup: backup,
    timestamp: Date.now()
});
```

**Why IndexedDB?** Tests can call `localStorage.clear()` freely - it doesn't affect IndexedDB. They're completely separate storage APIs.

### AppState.reload() - The Critical Final Step

After tests complete and localStorage is restored:

```javascript
// Clear test mode flag
localStorage.removeItem('__miniCycle_testModeActive__');

// CRITICAL: Sync in-memory state with restored localStorage
const AppState = getAppState();
if (AppState?.reload) {
    AppState.reload();
}
```

**Why is this critical?**

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE DEBOUNCE PROBLEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WITHOUT reload():                                               │
│                                                                  │
│  localStorage: { activeCycleId: "user-real-cycle" }  ← restored │
│  MiniCycleState.data: { activeCycleId: "cycle-main" } ← test!   │
│                                                                  │
│  → Next debounced save (600ms) overwrites localStorage          │
│  → User's real data is LOST                                     │
│                                                                  │
│  WITH reload():                                                  │
│                                                                  │
│  localStorage: { activeCycleId: "user-real-cycle" }  ← restored │
│  MiniCycleState.data: { activeCycleId: "user-real-cycle" } ← synced!
│                                                                  │
│  → Debounced saves write correct data                           │
│  → User's data is PRESERVED                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Protection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 FULL TEST DATA PROTECTION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BEFORE TESTS (testing-modal-integration.js):                    │
│  ├─ 1. AppState.forceSave()     → Flush pending changes         │
│  ├─ 2. backupManager.createTestBackup() → IndexedDB backup      │
│  └─ 3. Set test mode flag       → __miniCycle_testModeActive__  │
│                                                                  │
│  TEST SUITE STARTS (module-test-suite.html):                     │
│  └─ 4. Backup localStorage to IndexedDB → 'preTestBackup'       │
│                                                                  │
│  DURING TESTS:                                                   │
│  ├─ AppState.scheduleSave() sees flag → skips all saves         │
│  └─ Tests can modify localStorage freely (IndexedDB is safe)    │
│                                                                  │
│  AFTER TESTS (module-test-suite.html):                           │
│  └─ 1. Restore localStorage from IndexedDB backup               │
│                                                                  │
│  AFTER TESTS (testing-modal-integration.js):                     │
│  ├─ 2. Clear test mode flag                                     │
│  └─ 3. AppState.reload()        → Sync in-memory with restored  │
│                                                                  │
│  IF INTERRUPTED (automatic recovery on next app load):           │
│  ├─ coreBoot.js runs FIRST, before any modules load             │
│  ├─ Checks IndexedDB for testModeActive flag                    │
│  ├─ If found: restores localStorage from preTestBackup          │
│  ├─ Clears all flags                                            │
│  └─ AppState then loads normally from restored localStorage     │
│                                                                  │
│  SAVE SKIPPING (during active tests):                            │
│  ├─ Main app window: scheduleSave() checks testModeActive       │
│  ├─ If active: skips saves (prevents overwriting test data)     │
│  ├─ Test iframe: detected via ?embedded=true in URL             │
│  └─ Test iframe saves normally (tests need persistence)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `modules/boot/coreBoot.js` | Handles interrupted test recovery FIRST, before any modules load |
| `modules/core/appState.js` | Checks test mode flag in scheduleSave(), provides `reload()` |
| `modules/testing/testing-modal-integration.js` | Main testing modal logic, orchestrates test runs |
| `modules/storage/backupManager.js` | IndexedDB backup system (session, auto, test, manual) |
| `tests/module-test-suite.html` | Test suite runner, IndexedDB backup/restore, sets test mode flag |
| `tests/testHelpers.js` | Test utilities with localStorage protection |

---

## Protected localStorage Keys

The test mode flag uses a protected key prefix:

| Key | Purpose |
|-----|---------|
| `__miniCycle_testModeActive__` | Flag to pause AppState saves |

Note: The actual data backup is stored in **IndexedDB** (not localStorage), which makes it immune to any `localStorage.clear()` calls during tests.

---

## Progress Updates

The iframe sends progress via `postMessage`:

```javascript
// Progress update (sent for each module)
window.parent.postMessage({
    type: 'TEST_PROGRESS',
    currentModule: 'recurringCore',
    currentIndex: 15,
    totalModules: 85,
    moduleName: 'RecurringCore'
}, '*');

// Final results
window.parent.postMessage({
    type: 'TEST_RESULTS',
    totalPassed: 2195,
    totalTests: 2195,
    duration: 65.2,
    allPassed: true,
    failedModules: []
}, '*');
```

---

## Interrupted Tests

If tests are interrupted (browser closed, page refresh):

### Automatic Data Recovery (appState.js)

On next app load, `AppState._initializeInternal()` automatically handles recovery:

1. Checks if `__miniCycle_testModeActive__` localStorage flag is set (tests actively running)
2. If not running, checks IndexedDB for `testModeActive` record via `isTestModeActive()`
3. If test mode was active, calls `getBackedUpRealData()`:
   - Retrieves backup from `preTestBackup` record in IndexedDB
   - Clears localStorage and restores all keys from backup
4. Calls `clearTestModeAndBackup()` to clean up all flags and backups
5. AppState then loads the restored data normally

This happens during AppState initialization, so the user's data is seamlessly restored.

### Test Results Recovery

For displaying interrupted test results:

1. `checkForPendingResultsOnLoad()` runs after UI loads
2. Checks for results stored in IndexedDB (valid for 5 minutes)
3. If found, auto-opens testing modal and displays results

### Manual Recovery

User can also manually restore via **Settings > Restore Backups** (uses BackupManager test backups)

---

## Timeout

Tests timeout after 10 minutes (600,000ms). If no results received:

```javascript
setTimeout(() => {
    if (!resultsReceived) {
        appendToAutomatedTestResults("Test timeout - closing modal.");
        closeTestRunnerModal();
    }
}, 600000);
```

---

## Debugging

### View Test Logs

Open browser DevTools console while tests run. Key log prefixes:
- `🧪` - Testing modal operations
- `💾` - Backup/save operations
- `🔄` - State reload operations

### Manual Testing

Open the test suite directly:
```
http://localhost:8080/tests/module-test-suite.html
```

Select individual modules from dropdown for targeted testing.

---

## Related Documentation

- **[TESTING_GUIDE.md](../developer-guides/TESTING_GUIDE.md)** - Writing and running tests
- **[TESTING_README.md](./TESTING_README.md)** - Testing overview
- **[DEBUG_MODE.md](../developer-guides/DEBUG_MODE.md)** - Debug mode and AppState inspection

---

**Last Updated**: January 4, 2026
**Version**: 1.0
