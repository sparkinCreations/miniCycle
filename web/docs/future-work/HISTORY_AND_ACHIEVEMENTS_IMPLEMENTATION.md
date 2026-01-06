# History, Cleared Tasks & Achievements - Implementation Tracker

**Status:** Not Started
**Started:** -
**Completed:** -
**Estimated:** 8 days
**Actual:** -

---

## Reference Documents

- **Spec & Design:** [HISTORY_AND_ACHIEVEMENTS_PLAN.md](./HISTORY_AND_ACHIEVEMENTS_PLAN.md)
- **Schema Source:** `modules/core/types.js`
- **Feature List:** `docs/features/FEATURE_LIST.md`

---

## Progress Overview

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Foundation | Not Started | - | - | |
| 2. History Logging | Not Started | - | - | |
| 3. Cleared Tasks | Not Started | - | - | |
| 4. Achievement System | Not Started | - | - | |
| 5. UI - Stats Panels | Not Started | - | - | |
| 6. UI - Recreate Mode | Not Started | - | - | |
| 7. Polish & Testing | Not Started | - | - | |
| 8. Docs & Release | Not Started | - | - | |

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
  - **Notes:**

- [ ] **1.3 Update routine creation**
  - [ ] New routines get empty `history: { events: [] }`
  - [ ] New routines get empty `clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true }`
  - **File:** `modules/routine/routineManager.js`
  - **Notes:**

- [ ] **1.4 Write foundation tests**
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
  - [ ] Set up DI pattern (setHistoryManagerDependencies)
  - **File:** `modules/features/historyManager.js` (new)
  - **Notes:**

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
  - [ ] recreateTask removes entry from list
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

- [ ] **4.2 Define milestone thresholds**
  ```javascript
  const MILESTONES = [
    { id: 'getting_started', cycles: 5, tasks: 5, name: 'Getting Started' },
    { id: 'building_habits', cycles: 10, tasks: 25, name: 'Building Habits' },
    { id: 'consistent', cycles: 25, tasks: 100, name: 'Consistent', reward: 'dark-ocean' },
    { id: 'dedicated', cycles: 50, tasks: 250, name: 'Dedicated', reward: 'golden-glow' },
    { id: 'committed', cycles: 75, tasks: 350, name: 'Committed' },
    { id: 'century', cycles: 100, tasks: 500, name: 'Century', reward: 'whack-a-order' },
    { id: 'unstoppable', cycles: 200, tasks: 1000, name: 'Unstoppable' },
    { id: 'legendary', cycles: 500, tasks: 2500, name: 'Legendary' },
    { id: 'grandmaster', cycles: 1000, tasks: 5000, name: 'Grandmaster' },
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

## Phase 5: UI - Stats Panels
**Goal:** Three panels accessible in stats
**Status:** Not Started
**Blockers:** Phase 4

### Tasks

- [ ] **5.1 Update statsPanel.js structure**
  - [ ] Add History button (under Current Routine section)
  - [ ] Add Cleared Tasks button (under Current Routine, conditional)
  - [ ] Add Achievements button (always visible at bottom)
  - [ ] Add panel navigation state
  - **File:** `modules/features/statsPanel.js`
  - **Notes:**

- [ ] **5.2 Create History Panel view**
  - [ ] Back button
  - [ ] Chronological event list
  - [ ] Group by date (Today, Yesterday, Earlier)
  - [ ] Event type icons/labels
  - [ ] Clear All button
  - [ ] Empty state message
  - **File:** `modules/features/statsPanel.js` (or new sub-module)
  - **Notes:**

- [ ] **5.3 Create Cleared Tasks Panel view**
  - [ ] Back button
  - [ ] Total Cleared counter
  - [ ] "Showing last 90 days" label
  - [ ] Static list of entries
  - [ ] Recreate button (top right)
  - [ ] Clear Cleared List button (bottom)
  - [ ] Empty state message
  - **File:** `modules/features/statsPanel.js` (or new sub-module)
  - **Notes:**

- [ ] **5.4 Create Achievement History Panel view**
  - [ ] Back button
  - [ ] "Your Achievements" section
  - [ ] Unlocked achievements list (chronological)
  - [ ] Show how earned (cycles vs tasks)
  - [ ] Show reward if applicable
  - [ ] "Upcoming" section
  - [ ] Next milestones with progress
  - [ ] Empty state for no achievements
  - **File:** `modules/features/statsPanel.js` (or new sub-module)
  - **Notes:**

- [ ] **5.5 Panel navigation**
  - [ ] Track current panel state
  - [ ] Back button returns to main stats
  - [ ] Handle routine switch while in sub-panel
  - **Notes:**

- [ ] **5.6 Conditional visibility**
  - [ ] Cleared Tasks button only shows if entries exist
  - [ ] History button only shows if events exist (or always show?)
  - **Notes:**

### Phase 5 Completion Checklist
- [ ] All tasks complete
- [ ] All three panels render correctly
- [ ] Navigation works
- [ ] Data displays correctly
- [ ] Mobile responsive

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
  - [ ] Recreate creates tasks and removes entries
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

## Final Summary
**Total Duration:** -
**Phases Completed:** 0/8
**Tests Added:** -
**Files Modified:** -
**Files Created:** -

---

**Last Updated:** January 5, 2026
