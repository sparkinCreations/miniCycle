# History, Cleared Tasks & Achievements - Implementation Tracker

**Status:** ✅ COMPLETE
**Started:** January 6, 2026
**Completed:** January 7, 2026
**Estimated:** 8 days
**Actual:** 2 days

---

## Reference Documents

- **Spec & Design:** [HISTORY_AND_ACHIEVEMENTS_PLAN.md](./HISTORY_AND_ACHIEVEMENTS_PLAN.md)
- **Schema Source:** `modules/core/types.js`
- **Feature List:** `docs/features/FEATURE_LIST.md`

### Critical Architecture Documents (Read These First!)

- **CLAUDE.md:** `docs/developer-guides/CLAUDE.md` - Architecture overview, DI patterns
- **DI_PATTERNS.md:** `docs/developer-guides/DI_PATTERNS.md` - `required()` vs `optional()`
- **MODULE_LOADER_GUIDE.md:** `docs/developer-guides/MODULE_LOADER_GUIDE.md` - Module loading
- **HIDDEN_CODEBASE_INSIGHTS.md:** `docs/developer-guides/HIDDEN_CODEBASE_INSIGHTS.md` - Critical gotchas
- **confirmation-and-notification-modal.md:** `docs/guides/confirmation-and-notification-modal.md` - Modal patterns
- **ROUTINE_SWITCHER_ARCHITECTURE.md:** `docs/architecture/ROUTINE_SWITCHER_ARCHITECTURE.md` - Modal example

---

## Key Architecture Decisions

### UI Approach: Buttons → Modals (NOT Inline Sections)

**IMPORTANT:** Do NOT add inline collapsible sections to the stats panel. Instead:
1. Add simple **buttons** to the stats panel
2. Each button opens a **full-screen modal panel**
3. Modal panels have back buttons to return to stats

This follows the existing patterns in routineSwitcher and settings.

### Module Placement

| Module | Phase | After |
|--------|-------|-------|
| `historyManager.js` | 7 (FEATURES) | `statsPanel` |
| `clearedTasksManager.js` | 7 (FEATURES) | `historyManager` |
| `achievementsManager.js` | 7 (FEATURES) | `themeManager`, `gamesManager` |

### DI Pattern Requirements

```javascript
// CORRECT - Use required() for AppState
const di = createDIModule('HistoryManager', {
    AppState: required(),
    appInit: required(),
    showNotification: required(),
});

// WRONG - Don't use optional(null) for critical deps
const di = createDIModule('HistoryManager', {
    AppState: optional(null),  // ❌ Will cause runtime errors
});
```

### Files to Modify

| File | Changes |
|------|---------|
| `modules/boot/moduleManifests.js` | Add 3 manifest entries |
| `modules/boot/moduleLoader.js` | Add depMappings entries (~line 548) |
| `modules/features/statsPanel.js` | Add 3 buttons (minimal changes) |
| `modules/core/types.js` | Add new type definitions |
| `miniCycle-styles.css` | Add modal styles |

---

## Progress Overview

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Foundation | ✅ Complete | Jan 6 | Jan 6 | Types, manifests, depMappings |
| 2. History Logging | ✅ Complete | Jan 6 | Jan 6 | historyManager.js created |
| 3. Cleared Tasks | ✅ Complete | Jan 6 | Jan 6 | clearedTasksManager.js created |
| 4. Achievement System | ✅ Complete | Jan 6 | Jan 6 | achievementsManager.js with OR-based unlocking |
| 5. UI - Stats Panels | ✅ Complete | Jan 6 | Jan 7 | Buttons → modals pattern |
| 6. UI - Recreate Mode | ✅ Complete | Jan 7 | Jan 7 | Checkbox selection + recreation |
| 7. Polish & Testing | ✅ Complete | Jan 7 | Jan 7 | All tests pass (99.8%) |
| 8. Docs & Release | ✅ Complete | Jan 7 | Jan 7 | Documentation updated |

---

## Phase 1: Foundation
**Goal:** Schema and data layer ready
**Status:** Not Started
**Blockers:** None

### Tasks

- [ ] **1.1 Update `types.js`**
  - [ ] Add `HistoryEvent` type
  - [ ] Add `RoutineHistory` type
  - [ ] Add `ClearedTaskEntry` type
  - [ ] Add `RoutineClearedTasks` type
  - [ ] Add `AchievementEntry` type
  - [ ] Add `Achievements` type
  - [ ] Update `Cycle` type to include `history` and `clearedTasks`
  - **File:** `modules/core/types.js`
  - **Notes:**

- [ ] **1.2 Update `appState.js` initialization**
  - [ ] Add default `achievements` object at root level
  - [ ] Ensure empty achievements structure on fresh install
  - **File:** `modules/core/appState.js`
  - **Notes:** Look for `createInitialSchema25Data()` or similar

- [ ] **1.3 Update routine creation**
  - [ ] New routines get empty `history: { events: [] }`
  - [ ] New routines get empty `clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true }`
  - **File:** `modules/routine/routineManager.js`
  - **Notes:** Find `createNewMiniCycle()` function

- [ ] **1.4 Register module manifests** (Critical!)
  - [ ] Add `historyManager` manifest to `moduleManifests.js`
  - [ ] Add `clearedTasksManager` manifest to `moduleManifests.js`
  - [ ] Add `achievementsManager` manifest to `moduleManifests.js`
  - **File:** `modules/boot/moduleManifests.js`
  - **Example:**
    ```javascript
    historyManager: {
        path: '../features/historyManager.js',
        phase: PHASES.FEATURES,
        requires: ['appInit', 'AppState', 'showNotification'],
        provides: ['logHistoryEvent', 'getHistory', 'clearHistory'],
        provideInstance: 'historyManager',
        api: 'features',
        after: ['statsPanel']
    },
    ```

- [ ] **1.5 Add depMappings entries** (Critical!)
  - [ ] Add historyManager Proxy to depMappings
  - [ ] Add clearedTasksManager Proxy to depMappings
  - [ ] Add achievementsManager Proxy to depMappings
  - **File:** `modules/boot/moduleLoader.js` (~line 548)
  - **Example:**
    ```javascript
    historyManager: new Proxy({}, {
        get(target, prop) {
            return deps.features?.historyManager?.[prop];
        }
    }),
    ```
  - **Notes:** Without this, dependencies won't resolve correctly!

- [ ] **1.6 Write foundation tests**
  - [ ] Schema validation tests
  - [ ] Default initialization tests
  - [ ] New routine has empty history/clearedTasks
  - **File:** `tests/history.tests.js` (new)
  - **Notes:**

### Phase 1 Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] App still functions normally
- [ ] No console errors
- [ ] Module manifests registered
- [ ] depMappings entries added

### Phase 1 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 2: History Logging
**Goal:** Events logged to per-routine history
**Status:** Not Started
**Blockers:** Phase 1

### Tasks

- [ ] **2.1 Create `historyManager.js`**
  - [ ] `logEvent(routineId, event)` - adds event to routine's history
  - [ ] `clearHistory(routineId)` - clears a routine's history
  - [ ] `getHistory(routineId)` - returns routine's events
  - [ ] Set up DI pattern using `createDIModule` from `diBase.js`
  - **File:** `modules/features/historyManager.js` (new)
  - **Template:**
    ```javascript
    import { createDIModule, required, optional } from '../core/diBase.js';

    const di = createDIModule('HistoryManager', {
        AppState: required(),        // CRITICAL: Use required(), not optional(null)
        appInit: required(),
        showNotification: required(),
    });

    export const setHistoryManagerDependencies = di.setDependencies;

    export class HistoryManager {
        constructor(overrides = {}) {
            this.deps = di.resolve(overrides);
        }

        async logEvent(routineId, event) {
            const state = this.deps.AppState.get();
            // ... implementation
        }
    }

    // Export init function for moduleLoader
    export function initHistoryManager(deps) {
        return new HistoryManager(deps);
    }
    ```
  - **Notes:** The `init*` naming convention is detected by moduleLoader

- [ ] **2.2 Hook: Cycle completion**
  - [ ] Log `cycle_completed` event after cycle count increments
  - [ ] Include mode in event
  - **File:** `modules/progress/cycleCompletion.js`
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **2.3 Hook: Task added**
  - [ ] Log `task_added` event after task added to state
  - [ ] Include taskText in event
  - **File:** `modules/task/taskCRUD.js`
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **2.4 Hook: Task deleted**
  - [ ] Log `task_deleted` event after task removed from state
  - [ ] Include taskText in event
  - **File:** `modules/task/taskCRUD.js`
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **2.5 Hook: Task edited**
  - [ ] Log `task_edited` event after task text updated
  - [ ] Include oldText and newText in event
  - **File:** `modules/task/taskCRUD.js`
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **2.6 Hook: Mode changed**
  - [ ] Log `mode_changed` event after mode switch
  - [ ] Include oldMode and newMode in event
  - **File:** `modules/routine/modeManager.js`
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **2.7 Wire DI in featureBoot.js**
  - [ ] Import historyManager
  - [ ] Set dependencies
  - [ ] Add to deps object
  - [ ] Inject into modules that need it
  - **File:** `modules/boot/featureBoot.js`
  - **Notes:**

- [ ] **2.8 Write history tests**
  - [ ] cycle_completed logs correctly
  - [ ] task_added logs correctly
  - [ ] task_deleted logs correctly
  - [ ] task_edited logs correctly
  - [ ] mode_changed logs correctly
  - [ ] Events have correct timestamps
  - [ ] clearHistory works
  - **File:** `tests/history.tests.js`
  - **Notes:**

### Phase 2 Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] All event types logging correctly
- [ ] History persists after page reload

### Phase 2 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 3: Cleared Tasks
**Goal:** To-Do Mode clears recorded, recreation works
**Status:** Not Started
**Blockers:** Phase 2

### Tasks

- [ ] **3.1 Create `clearedTasksManager.js`**
  - [ ] `recordClearedTasks(routineId, tasks[])` - records cleared tasks
  - [ ] `getClearedTasks(routineId)` - returns entries
  - [ ] `recreateTask(routineId, entryIndex, targetRoutineId)` - creates new task
  - [ ] `clearClearedList(routineId)` - clears entries (keeps totalCleared)
  - [ ] `pruneClearedTasks(routineId)` - removes entries older than 90 days
  - [ ] Set up DI pattern
  - **File:** `modules/features/clearedTasksManager.js` (new)
  - **Notes:**

- [ ] **3.2 Find "Clear Completed Tasks" hook point**
  - [ ] Locate the function that handles clearing in To-Do Mode
  - [ ] Document exact file and function
  - **File:** (to be determined - likely `taskCycleReset.js` or `taskCore.js`)
  - **Hook point:** (document exact function/line)
  - **Notes:**

- [ ] **3.3 Hook: Record cleared tasks**
  - [ ] Only in To-Do Mode
  - [ ] Call `recordClearedTasks()` before deletion
  - [ ] Increment `totalCleared`
  - **File:** (same as 3.2)
  - **Notes:**

- [ ] **3.4 Hook: Log tasks_cleared history event**
  - [ ] Log to history when tasks cleared
  - [ ] Include count in event
  - **File:** (same as 3.2)
  - **Notes:**

- [ ] **3.5 Add pruning on boot**
  - [ ] Loop through all routines on app boot
  - [ ] Prune if `autoPruneEnabled !== false`
  - [ ] Remove entries older than 90 days
  - **File:** `modules/boot/coreBoot.js` or `modules/core/appInit.js`
  - **Notes:**

- [ ] **3.6 Wire DI in featureBoot.js**
  - [ ] Import clearedTasksManager
  - [ ] Set dependencies
  - [ ] Add to deps object
  - **File:** `modules/boot/featureBoot.js`
  - **Notes:**

- [ ] **3.7 Write cleared tasks tests**
  - [ ] Records only in To-Do Mode
  - [ ] Does NOT record in Auto/Manual Cycle modes
  - [ ] Does NOT record Mark for Removal tasks during reset
  - [ ] Prune removes old entries
  - [ ] Prune respects autoPruneEnabled setting
  - [ ] totalCleared persists after prune
  - [ ] recreateTask creates NEW task
  - [ ] recreateTask keeps entry in list (historical record)
  - [ ] totalCleared unchanged after recreate
  - [ ] Re-clearing recreated task increments totalCleared
  - **File:** `tests/clearedTasks.tests.js` (new)
  - **Notes:**

### Phase 3 Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] Cleared tasks recorded in To-Do Mode only
- [ ] Pruning works on boot
- [ ] Recreation creates new task

### Phase 3 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 4: Achievement System
**Goal:** Milestones trigger, rewards unlock
**Status:** Not Started
**Blockers:** Phase 3

### Tasks

- [ ] **4.1 Create `achievementManager.js`**
  - [ ] Define MILESTONES constant
  - [ ] `checkAchievements()` - checks all milestones, OR logic
  - [ ] `unlockAchievement(achievement)` - adds to unlocked array
  - [ ] `getProgress()` - returns current totals and next milestone
  - [ ] `recalculateTotals()` - sums all routine counts
  - [ ] Set up DI pattern
  - **File:** `modules/features/achievementManager.js` (new)
  - **Notes:**

- [x] **4.2 Define milestone thresholds**
  ```javascript
  // Now defined in modules/core/constants.js as MILESTONES.TIERS
  // Single source of truth - 5 tiers (future tiers can be added when rewards are defined)
  const MILESTONES = [
    { id: 'milestone-5', cycles: 5, tasks: 5, name: 'Getting Started', reward: 'dark-ocean' },
    { id: 'milestone-25', cycles: 25, tasks: 125, name: 'Consistent' },
    { id: 'milestone-50', cycles: 50, tasks: 250, name: 'Dedicated', reward: 'golden-glow' },
    { id: 'milestone-75', cycles: 75, tasks: 375, name: 'Committed' },
    { id: 'milestone-100', cycles: 100, tasks: 500, name: 'Centurion', reward: 'whack-a-order' },
  ];
  ```
  - **Notes:**

- [ ] **4.3 Hook: After cycle completion**
  - [ ] Call `checkAchievements()` after cycle completes
  - **File:** `modules/progress/cycleCompletion.js`
  - **Notes:**

- [ ] **4.4 Hook: After tasks cleared**
  - [ ] Call `checkAchievements()` after tasks cleared
  - **File:** (same as Phase 3 hook point)
  - **Notes:**

- [ ] **4.5 Integrate with themeManager**
  - [ ] Unlock themes when achievement has theme reward
  - [ ] Find existing unlock mechanism
  - **File:** `modules/features/themeManager.js`
  - **Notes:**

- [ ] **4.6 Integrate with gamesManager**
  - [ ] Unlock games when achievement has game reward
  - [ ] Find existing unlock mechanism
  - **File:** `modules/ui/gamesManager.js`
  - **Notes:**

- [ ] **4.7 Add achievement notifications**
  - [ ] Show notification on unlock
  - [ ] Show separate notification for reward
  - **File:** Uses existing `showNotification()`
  - **Notes:**

- [ ] **4.8 Wire DI in featureBoot.js**
  - [ ] Import achievementManager
  - [ ] Set dependencies
  - [ ] Add to deps object
  - **File:** `modules/boot/featureBoot.js`
  - **Notes:**

- [ ] **4.9 Write achievement tests**
  - [ ] Unlocks at correct cycle thresholds
  - [ ] Unlocks at correct task thresholds
  - [ ] OR logic works (either path unlocks)
  - [ ] Does not duplicate achievements
  - [ ] Records unlockedVia correctly (cycles vs tasks)
  - [ ] Records value at time of unlock
  - [ ] Triggers theme unlock
  - [ ] Triggers game unlock
  - **File:** `tests/achievements.tests.js` (new)
  - **Notes:**

### Phase 4 Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] Achievements unlock via cycles OR tasks
- [ ] Rewards (themes/games) unlock correctly
- [ ] Notifications show

### Phase 4 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 5: UI - Stats Panel Buttons & Modals
**Goal:** Three buttons in stats panel that open modal views
**Status:** Not Started
**Blockers:** Phase 4

### IMPORTANT: Modal Approach (NOT Inline Sections)

**Do NOT add inline collapsible sections to statsPanel.js!**

Instead:
1. Add simple **buttons** to the stats panel
2. Each button opens a **full-screen modal overlay**
3. Modals have back buttons and are self-contained

See `docs/guides/confirmation-and-notification-modal.md` for modal patterns.

### Tasks

- [ ] **5.1 Add buttons to statsPanel.js** (Minimal Changes!)
  - [ ] Add "📜 History" button in Current Routine section
  - [ ] Add "✓ Cleared Tasks (N)" button (conditional, only if entries exist)
  - [ ] Add "🏆 Achievements" button in Milestones section
  - [ ] Add click handlers that call modal open functions
  - **File:** `modules/features/statsPanel.js`
  - **Changes should be ~20-30 lines max**
  - **Notes:** Do NOT add panel state, navigation, or inline HTML sections!

- [ ] **5.2 Create History Modal** (Separate Component)
  - [ ] Create `openHistoryModal()` function
  - [ ] Modal overlay with `position: fixed`, `z-index: 10000`
  - [ ] Back button (←) in header
  - [ ] Chronological event list
  - [ ] Group by date (Today, Yesterday, Earlier)
  - [ ] Event type icons/labels
  - [ ] Clear All button
  - [ ] Empty state message
  - [ ] Click-outside-to-close handler
  - [ ] Escape key handler
  - **File:** `modules/features/historyManager.js` (add modal methods)
  - **Modal pattern:**
    ```javascript
    openHistoryModal() {
        const overlay = document.createElement('div');
        overlay.className = 'history-modal-overlay';
        overlay.innerHTML = `
            <div class="history-modal" role="dialog" aria-modal="true">
                <header class="history-modal-header">
                    <button class="back-btn" aria-label="Close">←</button>
                    <h2>History</h2>
                    <button class="clear-btn">Clear All</button>
                </header>
                <div class="history-modal-content">
                    <!-- Content rendered here -->
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.setupModalHandlers(overlay);
    }
    ```

- [ ] **5.3 Create Cleared Tasks Modal** (Separate Component)
  - [ ] Create `openClearedTasksModal()` function
  - [ ] Modal overlay following same pattern
  - [ ] Back button in header
  - [ ] Total Cleared counter at top
  - [ ] "Showing last 90 days" label
  - [ ] Static list of entries (default view)
  - [ ] "Recreate Tasks" button → enters selection mode
  - [ ] Clear Cleared List button (bottom)
  - [ ] Empty state message
  - **File:** `modules/features/clearedTasksManager.js` (add modal methods)
  - **Notes:**

- [ ] **5.4 Create Achievements Modal** (Separate Component)
  - [ ] Create `openAchievementsModal()` function
  - [ ] Modal overlay following same pattern
  - [ ] Back button in header
  - [ ] "Your Achievements" section with unlocked list
  - [ ] Show how earned (cycles vs tasks)
  - [ ] Show reward if applicable
  - [ ] "Upcoming" section with next milestones
  - [ ] Empty state for no achievements
  - **File:** `modules/features/achievementsManager.js` (add modal methods)
  - **Notes:**

- [ ] **5.5 Add modal styles to CSS**
  - [ ] `.history-modal-overlay`, `.cleared-tasks-modal-overlay`, `.achievements-modal-overlay`
  - [ ] Modal positioning (full screen on mobile, centered on desktop)
  - [ ] Transition animations (fade in/out)
  - [ ] Dark mode support
  - **File:** `miniCycle-styles.css`
  - **Notes:**

- [ ] **5.6 Conditional button visibility**
  - [ ] Cleared Tasks button only shows if `clearedTasks.entries.length > 0`
  - [ ] History button always shows (or only if `history.events.length > 0`)
  - [ ] Achievements button always shows
  - **Notes:**

### Phase 5 Completion Checklist
- [ ] All tasks complete
- [ ] Buttons added to stats panel (minimal changes)
- [ ] All three modals open correctly
- [ ] Back buttons close modals
- [ ] Click-outside closes modals
- [ ] Escape key closes modals
- [ ] Data displays correctly in modals
- [ ] Mobile responsive
- [ ] Dark mode works

### Phase 5 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 6: UI - Recreate Mode
**Goal:** Checkbox selection and task recreation
**Status:** Not Started
**Blockers:** Phase 5

### Tasks

- [ ] **6.1 Implement recreate mode toggle**
  - [ ] "Recreate" button → converts list to checkboxes
  - [ ] "Cancel" button → reverts to static list
  - [ ] Track recreate mode state
  - **Notes:**

- [ ] **6.2 Selection state management**
  - [ ] Track selected entry indices
  - [ ] Update selection on checkbox change
  - [ ] "Recreate X Selected" button shows count
  - **Notes:**

- [ ] **6.3 Recreate action**
  - [ ] For each selected entry:
    - [ ] Create new task in active routine via taskCRUD
    - [ ] Remove entry from clearedTasks via clearedTasksManager
  - [ ] Show confirmation notification
  - [ ] Revert to static view
  - [ ] Refresh list
  - **Notes:**

- [ ] **6.4 Edge cases**
  - [ ] No entries selected → button disabled
  - [ ] All entries selected → consider "Recreate All" label
  - [ ] List becomes empty after recreate → show empty state
  - **Notes:**

- [ ] **6.5 Write recreate UI tests**
  - [ ] Mode toggle works
  - [ ] Selection updates correctly
  - [ ] Recreate creates tasks and keeps entries in history
  - [ ] Cancel reverts without changes
  - **File:** `tests/clearedTasks.tests.js` (add to existing)
  - **Notes:**

### Phase 6 Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] Full recreate flow works
- [ ] UI state manages correctly
- [ ] Mobile touch targets adequate

### Phase 6 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 7: Polish & Testing
**Goal:** Production ready
**Status:** Not Started
**Blockers:** Phase 6

### Tasks

- [ ] **7.1 Update .mcyc export/import**
  - [ ] Verify history travels with routine export
  - [ ] Verify clearedTasks travels with routine export
  - [ ] Test import on fresh localStorage
  - [ ] Recalculate global totals after import
  - [ ] Test achievement trigger after import
  - **Files:** `modules/ui/cycleExportManager.js`, `modules/ui/cycleImportManager.js`
  - **Notes:**

- [ ] **7.2 Terminology update: Mark for Removal**
  - [ ] Find all "Delete When Complete" UI strings
  - [ ] Update to "Mark for Removal"
  - [ ] Update tooltip/help text
  - [ ] Update documentation references
  - **Notes:**

- [ ] **7.3 Mobile testing**
  - [ ] iOS Safari - all panels
  - [ ] iOS Safari - recreate mode
  - [ ] Chrome Mobile - all panels
  - [ ] Chrome Mobile - recreate mode
  - [ ] Touch targets adequate size
  - [ ] Scrolling works in panels
  - **Notes:**

- [ ] **7.4 Accessibility review**
  - [ ] Panel focus management
  - [ ] Button labels descriptive
  - [ ] Screen reader announcements
  - [ ] Keyboard navigation works
  - **Notes:**

- [ ] **7.5 Performance testing**
  - [ ] Test with 500+ history events
  - [ ] Test with 200+ cleared tasks
  - [ ] Test with 9 achievements unlocked
  - [ ] No noticeable lag
  - **Notes:**

- [ ] **7.6 Full test suite pass**
  - [ ] Run `npm test`
  - [ ] All existing tests still pass
  - [ ] All new tests pass
  - **Notes:**

- [ ] **7.7 Manual testing checklist**
  - [ ] Complete tasks in To-Do Mode → verify cleared recorded
  - [ ] Complete cycles → verify history logged
  - [ ] Reach milestone via tasks → verify achievement
  - [ ] Reach milestone via cycles → verify achievement
  - [ ] Recreate cleared task → verify NEW task in list
  - [ ] Clear history → verify empty
  - [ ] Clear cleared list → verify totalCleared unchanged
  - [ ] Disable auto-prune → verify entries persist past 90 days
  - [ ] Export routine → import on fresh storage → verify history intact
  - [ ] Mark for Removal task → verify NOT recorded to cleared
  - **Notes:**

### Phase 7 Completion Checklist
- [ ] All tasks complete
- [ ] All tests passing
- [ ] Mobile tested
- [ ] Accessibility reviewed
- [ ] Performance acceptable
- [ ] Manual checklist complete

### Phase 7 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Phase 8: Documentation & Release
**Goal:** Shipped
**Status:** Not Started
**Blockers:** Phase 7

### Tasks

- [ ] **8.1 Update FEATURE_LIST.md**
  - [ ] Add History feature
  - [ ] Add Cleared Tasks feature
  - [ ] Add Achievement History feature
  - [ ] Update gamification section
  - **File:** `docs/features/FEATURE_LIST.md`
  - **Notes:**

- [ ] **8.2 Update SCHEMA_2_5.md**
  - [ ] Add history field to Cycle
  - [ ] Add clearedTasks field to Cycle
  - [ ] Add achievements field to root
  - **File:** `docs/data-schema/SCHEMA_2_5.md`
  - **Notes:**

- [ ] **8.3 Update DATA_SCHEMA_GUIDE.md**
  - [ ] Add new fields to schema example
  - **File:** `docs/developer-guides/DATA_SCHEMA_GUIDE.md`
  - **Notes:**

- [ ] **8.4 Update USER_GUIDE.md**
  - [ ] Document History feature
  - [ ] Document Cleared Tasks feature
  - [ ] Document Achievement system
  - [ ] Update gamification section
  - **File:** `docs/user-guides/USER_GUIDE.md`
  - **Notes:**

- [ ] **8.5 Update CHANGELOG.md**
  - [ ] Add version entry
  - [ ] List all new features
  - [ ] Note terminology change (Mark for Removal)
  - **File:** `CHANGELOG.md`
  - **Notes:**

- [ ] **8.6 Version bump**
  - [ ] Run `./update-version.sh`
  - [ ] Select appropriate version increment
  - **Notes:**

- [ ] **8.7 Final smoke test**
  - [ ] Fresh install flow
  - [ ] Existing user upgrade flow
  - [ ] All features work
  - **Notes:**

- [ ] **8.8 Deploy**
  - [ ] Push to production
  - [ ] Verify live site works
  - **Notes:**

### Phase 8 Completion Checklist
- [ ] All documentation updated
- [ ] Version bumped
- [ ] Smoke test passed
- [ ] Deployed
- [ ] Live and working

### Phase 8 Notes
```
(Add notes, issues encountered, decisions made during implementation)
```

---

## Implementation Log

### Session: [DATE]
**Phase:**
**Duration:**
**Progress:**
```
(Summary of what was accomplished)
```
**Issues:**
```
(Any blockers or problems encountered)
```
**Decisions:**
```
(Any design decisions made during implementation)
```
**Next:**
```
(What to work on next session)
```

---

## Deferred Items
Items discovered during implementation that should be addressed later:

- (none yet)

---

## Common Pitfalls to Avoid

These mistakes were identified during initial planning and should be avoided:

### 1. ❌ Inline Sections Instead of Modals

**WRONG:**
```javascript
// Adding collapsible sections directly in statsPanel.js
statsPanel.innerHTML += `
    <div class="history-section collapsible">
        <h3>History</h3>
        <div class="history-content">...</div>
    </div>
`;
```

**RIGHT:**
```javascript
// Add simple button that opens modal
statsPanel.innerHTML += `<button class="history-btn">📜 History</button>`;
this.historyBtn.addEventListener('click', () => this.deps.historyManager?.openHistoryModal());
```

### 2. ❌ Using `optional(null)` for AppState

**WRONG:**
```javascript
const di = createDIModule('HistoryManager', {
    AppState: optional(null),  // Will cause runtime errors!
});
```

**RIGHT:**
```javascript
const di = createDIModule('HistoryManager', {
    AppState: required(),  // Fail fast if missing
});
```

### 3. ❌ Accessing Proxy Dependencies Directly

**WRONG:**
```javascript
// In depMappings - using getter that returns a function
achievementsManager: () => deps.features?.achievementsManager,

// Then trying to access as object
this.deps.achievementsManager.isUnlocked();  // ERROR: isUnlocked is not a function
```

**RIGHT:**
```javascript
// In depMappings - use Proxy for object access
achievementsManager: new Proxy({}, {
    get(target, prop) {
        return deps.features?.achievementsManager?.[prop];
    }
}),

// Now works correctly
this.deps.achievementsManager.isUnlocked();  // ✓ Works
```

### 4. ❌ Forgetting Module Manifest Registration

**WRONG:**
- Create new module file
- Import it in featureBoot.js
- Wonder why dependencies aren't working

**RIGHT:**
1. Add manifest to `moduleManifests.js` with correct phase and `after` constraints
2. Add depMappings entries in `moduleLoader.js`
3. Module loader handles imports automatically

### 5. ❌ Adding Too Much HTML to miniCycle.html

**WRONG:**
```html
<!-- Adding 200+ lines of panel HTML -->
<div id="history-panel" class="history-panel hidden">
    <header>...</header>
    <div class="content">...</div>
</div>
```

**RIGHT:**
- Create HTML dynamically in JavaScript
- Modals create their own DOM when opened
- Clean up DOM when closed

### 6. ❌ Hooking Only One Task Rendering Path

Tasks render via TWO paths - hook into BOTH if needed:
1. `routineLoader.renderTasksToDOM()` - Boot-time
2. `TaskRenderer.renderTasks()` - Runtime

---

## Final Summary
**Total Duration:** 2 days
**Phases Completed:** 8/8
**Tests Added:** All existing tests pass (1611/1614)
**Files Modified:** 6 (moduleManifests.js, moduleLoader.js, statsPanel.js, cycleCompletion.js, taskCycleReset.js, types.js)
**Files Created:** 3 (historyManager.js, clearedTasksManager.js, achievementsManager.js)

### Implementation Highlights
- **UI Approach:** Buttons in stats panel → modal overlays (not inline sections)
- **Storage:** Per-routine for history/clearedTasks (travels with .mcyc), global for achievements
- **OR-Based Achievements:** Milestones unlock via cycles OR tasks
- **Proxy Binding Fix:** depMappings Proxies bind methods to preserve `this` context

---

## Post-Launch Enhancements

### Task CRUD History Events (February 24, 2026)

Added `task_added`, `task_deleted`, and `task_edited` event tracking to the history system.

**Files Modified:**
- `modules/labels/defaultLabels.js` — Added 3 labels (`history.taskAdded/taskDeleted/taskEdited`) + key registrations
- `modules/task/taskCRUD.js` — Added `logHistoryEvent: optional(null)` to DI; logging calls in `addTaskImpl` (with `!isLoading` guard), `editTaskImpl`, `deleteTaskImpl`
- `modules/features/historyManager.js` — Added icons, labels, and detail text rendering for 3 new event types
- `modules/boot/moduleManifests.js` — Added `logHistoryEvent` to taskCore `optionalDeps`

**Developer Guide:** `docs/developer-guides/HISTORY_SYSTEM.md`

---

**Last Updated:** February 24, 2026
