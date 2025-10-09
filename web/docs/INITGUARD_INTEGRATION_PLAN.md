# InitGuard Integration Plan
**Status:** Implementation Ready
**Date:** October 9, 2025

---

## 🎯 Goals

Replace all race condition hacks with clean 2-phase initialization:

### **Current Problems:**
- ❌ Line 398: `window._deferredStatsUpdates = []` - Deferred queue hack
- ❌ Line 754: `await new Promise(resolve => setTimeout(resolve, 50))` - 50ms hack
- ❌ Line 757-767: Manual deferred queue processing
- ❌ Line 727-734: Another setTimeout(50ms) hack for undo snapshot

### **InitGuard Solution:**
- ✅ Phase 1 (Core): AppState + Data loaded
- ✅ Phase 2 (App): All modules initialized
- ✅ Modules use `await initGuard.waitForCore()` instead of deferred queues
- ✅ Plugin support built-in for future extensibility

---

## 📋 Implementation Steps

### **Step 1: Import InitGuard** ✅ DONE
Created `/utilities/initGuard.js` with:
- 2-phase system (core + app)
- Plugin registry
- Hook system (beforeCore, afterCore, beforeApp, afterApp)
- Debug utilities

### **Step 2: Update Main Initialization** 🔄 IN PROGRESS

**File:** `miniCycle-scripts.js`

**Changes needed:**

```javascript
// ADD at top of DOMContentLoaded (after line 301)
import { initGuard } from './utilities/initGuard.js';

// CURRENT (lines 348-416):
await import('./utilities/globalUtils.js');
const { MiniCycleNotifications } = await import('./utilities/notifications.js');
// ... module imports
// Then much later (line 674): AppState initialization

// NEW STRUCTURE:
// ============ PHASE 1: CORE ============
console.log('🔧 Phase 1: Initializing core systems...');

// 1A: Load basic utilities
await import('./utilities/globalUtils.js');
const { MiniCycleNotifications } = await import('./utilities/notifications.js');
// Set up notifications early

// 1B: Initialize AppState
const { createStateManager } = await import('./utilities/state.js');
window.AppState = createStateManager({...});
await window.AppState.init();

// 1C: Load cycle data
await loadMiniCycleData(); // or whatever your data load function is

// 1D: Mark core ready (CRITICAL - unblocks all waiting modules)
await initGuard.markCoreReady();
console.log('✅ Core ready - modules can now safely access AppState and data');

// ============ PHASE 2: MODULES ============
console.log('🔌 Phase 2: Loading modules...');

// These can load in parallel - they wait for core internally
await Promise.all([
    setupStatsPanel(),
    setupDeviceDetection(),
    setupRecurringSystem()
]);

// Mark app ready
await initGuard.markAppReady();

// ============ PHASE 3: UI ============
refreshUIFromState();
updateStatsPanel();
```

**DELETE these sections:**
- Line 398: `window._deferredStatsUpdates = []`
- Lines 407-415: The deferred queue logic in `updateStatsPanel()`
- Line 754: `await new Promise(resolve => setTimeout(resolve, 50))`
- Lines 757-767: Deferred stats processing
- Lines 769+: Deferred recurring processing
- Line 727-734: setTimeout(50ms) for undo snapshot

### **Step 3: Update statsPanel.js** ⏳ PENDING

**File:** `utilities/statsPanel.js`

**Changes:**

```javascript
// ADD import at top
import { initGuard } from './initGuard.js';

// CURRENT updateStatsPanel() (has no async/await):
updateStatsPanel() {
    // Tries to access AppState immediately
    const state = this.deps.loadData();
    // ...
}

// NEW updateStatsPanel():
async updateStatsPanel() {
    // Wait for core if needed
    await initGuard.waitForCore();

    // Now safe to access AppState
    const state = this.deps.loadData();
    // ...
}
```

**Also update init():**
```javascript
async init() {
    await initGuard.waitForCore();
    // Rest of init logic
}
```

### **Step 4: Update recurringCore.js** ⏳ PENDING

**File:** `utilities/recurringCore.js`

**Changes:**

```javascript
// ADD import
import { initGuard } from './initGuard.js';

// CURRENT watchRecurringTasks():
function watchRecurringTasks() {
    setInterval(() => {
        // Might run before AppState ready
        checkAndRecreateRecurringTasks();
    }, 30000);
}

// NEW watchRecurringTasks():
async function watchRecurringTasks() {
    // Don't start watching until core is ready
    await initGuard.waitForCore();

    setInterval(() => {
        // Safe to check - core was ready when watcher started
        if (initGuard.isCoreReady()) {
            checkAndRecreateRecurringTasks();
        }
    }, 30000);
}
```

### **Step 5: Update recurringPanel.js** ⏳ PENDING

**File:** `utilities/recurringPanel.js`

**Changes:**

```javascript
// ADD import
import { initGuard } from './initGuard.js';

// Update methods that access AppState:
async updateRecurringPanel() {
    await initGuard.waitForCore();
    // Safe to proceed
    const state = this.deps.getAppState();
    // ...
}

async openPanel() {
    await initGuard.waitForCore();
    // Safe to open panel
    // ...
}
```

### **Step 6: Update recurringIntegration.js** ⏳ PENDING

**File:** `utilities/recurringIntegration.js`

**Changes:**

```javascript
// ADD import
import { initGuard } from './initGuard.js';

// CURRENT initializeRecurringModules():
export async function initializeRecurringModules() {
    // Checks if AppState exists
    if (!window.AppState?.isReady?.()) {
        throw new Error('AppState not ready');
    }
    // ...
}

// NEW initializeRecurringModules():
export async function initializeRecurringModules() {
    // Wait for core instead of checking
    await initGuard.waitForCore();

    // Now safe to proceed - no need for checks
    // ...
}
```

---

## 🧹 Cleanup Checklist

### **Delete These:**
- [ ] `window._deferredStatsUpdates` array and all references
- [ ] `window._deferredRecurringSetup` array and all references
- [ ] All `setTimeout(..., 50)` hacks waiting for AppState
- [ ] All `setTimeout(..., 0)` hacks for state sync
- [ ] Manual deferred queue processing loops
- [ ] Defensive `if (window.AppState?.isReady())` checks (replace with await)

### **Replace These:**
- [ ] `if (!AppState.isReady()) { defer(); return; }` → `await initGuard.waitForCore()`
- [ ] `setTimeout(() => { ... }, 50)` → `await initGuard.waitForCore()`
- [ ] Manual queue processing → Module methods are now async and wait properly

---

## 🧪 Testing Strategy

### **Phase 1: Verify Core Phase**
1. Open browser console
2. Check logs: `✅ Core ready` should appear after AppState init
3. Run: `initGuard.printStatus()` - should show `coreReady: true`

### **Phase 2: Verify Module Wait**
1. Add console.log in statsPanel before/after waitForCore
2. Should see: `⏳ Waiting for core...` then immediately proceeds (no delay)

### **Phase 3: Verify No Race Conditions**
1. Hard refresh (Cmd+Shift+R)
2. Check stats panel loads correctly
3. Check recurring tasks work
4. No console errors about AppState not ready

### **Phase 4: Performance Check**
```javascript
// Should see in console:
// ✅ Core ready (200-300ms)
// ✅ App ready (50-100ms) - Total: ~400ms

// OLD way had:
// - Multiple setTimeout(50ms) = 150ms+ wasted
// - Deferred queue processing = extra frames
```

---

## 🔌 Future: Plugin Examples

Once InitGuard is integrated, adding plugins is trivial:

### **Example: Analytics Plugin**
```javascript
// plugins/analytics.js
export class AnalyticsPlugin {
    constructor() {
        this.name = 'analytics';
        this.version = '1.0.0';
    }

    async init() {
        await initGuard.waitForCore();

        // Track state changes
        window.AppState.subscribe('tasks', (newState) => {
            this.trackEvent('tasks_changed', {
                count: newState.data.cycles[newState.appState.activeCycleId]?.tasks.length
            });
        });
    }

    trackEvent(name, data) {
        console.log('📊 Analytics:', name, data);
        // Send to analytics service
    }
}

// In main script:
import { AnalyticsPlugin } from './plugins/analytics.js';
const analytics = new AnalyticsPlugin();
initGuard.registerPlugin('analytics', analytics);
await analytics.init();
```

### **Example: Using Hooks**
```javascript
// Add a hook to run after core ready
initGuard.addHook('afterCore', async () => {
    console.log('🎉 Core is ready, doing custom initialization');
    await myCustomSetup();
});
```

---

## 📊 Expected Benefits

### **Code Reduction:**
- Remove ~100 lines of deferred queue logic
- Remove ~50 lines of defensive checks
- Remove ~20 lines of setTimeout hacks
- **Total: ~170 lines deleted**

### **Performance:**
- No artificial 50ms delays
- Modules proceed as soon as core is ready (not on timers)
- Parallel module loading where possible
- **Est. 100-200ms faster boot time**

### **Maintainability:**
- One clear initialization pattern
- Easy to add new modules (just await core)
- Plugin system for future extensibility
- Clear debug info: `initGuard.printStatus()`

### **Reliability:**
- No race conditions
- No timing-dependent behavior
- Clear dependency order
- Proper error handling

---

## 🚀 Implementation Order

1. ✅ **Day 1 Morning:** Create InitGuard (DONE)
2. ⏳ **Day 1 Afternoon:** Integrate into main script
3. ⏳ **Day 2 Morning:** Update statsPanel, deviceDetection
4. ⏳ **Day 2 Afternoon:** Update recurring system (core + panel + integration)
5. ⏳ **Day 3:** Remove all deferred queues and setTimeout hacks
6. ⏳ **Day 3:** Testing and validation
7. ⏳ **Day 4:** Documentation updates

---

## 🎯 Success Criteria

- [ ] No `window._deferredStatsUpdates` in codebase
- [ ] No `setTimeout(..., 50)` for AppState timing
- [ ] All modules use `await initGuard.waitForCore()`
- [ ] Hard refresh works perfectly (no race conditions)
- [ ] Console shows clean phase progression
- [ ] Stats panel loads on first try
- [ ] Recurring tasks work immediately
- [ ] Boot time improved by 100-200ms

---

**Ready to implement!** Start with Step 2 (main script integration).
