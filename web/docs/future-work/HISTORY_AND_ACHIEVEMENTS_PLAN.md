# History, Cleared Tasks & Achievement System Plan

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 4-6 days
**Breaking Changes:** No (schema additions only)

---

## Overview

This document outlines three interconnected features that enhance progress tracking and gamification in miniCycle:

1. **History** - Activity log tracking routine/task changes across all modes
2. **Cleared Tasks** - Temporary history of completed To-Do mode tasks with optional recreation
3. **Achievement History** - App-wide achievement/milestone tracking

These features work together to:
- Give To-Do Mode users visible progress and gamification rewards
- Provide an activity audit trail for all routine changes
- Create a unified achievement system that rewards both cycle completions AND task completions

**Design Philosophy:**

This is NOT an archive system. It's:
- A **clearing mechanism** - tasks move forward, not into storage
- A **temporary progress ledger** - tracks accomplishments for gamification
- A **conversion layer** - cleared tasks can be recreated, not restored

```
Completion → Clearing → Forward Motion
```

---

## Table of Contents

1. [History (Activity Log)](#1-history-activity-log)
2. [Cleared Tasks (To-Do Mode)](#2-cleared-tasks-to-do-mode)
3. [Achievement History](#3-achievement-history)
4. [Schema Additions](#4-schema-additions)
5. [UI Design](#5-ui-design)
6. [Gamification Integration](#6-gamification-integration)
7. [Storage Considerations](#7-storage-considerations)
8. [Implementation Plan](#8-implementation-plan)
9. [Testing Requirements](#9-testing-requirements)

---

## 1. History (Activity Log)

### Purpose

A read-only activity log that tracks significant events across all routines and modes. Provides users with visibility into what changed and when.

### Tracked Events

| Event Type | Data Captured | Modes |
|------------|---------------|-------|
| `cycle_completed` | routine, mode, timestamp | Auto Cycle, Manual Cycle |
| `task_added` | routine, taskText, timestamp | All |
| `task_deleted` | routine, taskText, timestamp | All |
| `task_edited` | routine, oldText, newText, timestamp | All |
| `tasks_cleared` | routine, count, timestamp | To-Do Mode |
| `routine_created` | routine, mode, timestamp | All |
| `routine_deleted` | routine, timestamp | All |
| `routine_renamed` | oldName, newName, timestamp | All |
| `mode_changed` | routine, oldMode, newMode, timestamp | All |

### Event Structure

```javascript
{
  type: "cycle_completed",      // Event type
  routine: "Morning Routine",   // Routine name
  mode: "auto-cycle",           // Mode at time of event
  timestamp: "2026-01-05T10:30:00.000Z",
  // Optional fields depending on event type:
  taskText: "Buy groceries",    // For task events
  oldText: "Meeting",           // For task_edited
  newText: "Team standup",      // For task_edited
  oldName: "Old Routine",       // For routine_renamed
  newName: "New Routine",       // For routine_renamed
  oldMode: "auto-cycle",        // For mode_changed
  newMode: "todo-mode",         // For mode_changed
  count: 5                      // For tasks_cleared
}
```

### Behavior

- **Read-only** - Users cannot edit or delete individual entries
- **Chronological** - Newest events at top
- **Clearable** - "Clear History" button removes all entries
- **No retention limit** - Events are lightweight; clear manually if desired
- **Optional** - Could add setting to disable history tracking

### Use Cases

- "When did I last complete my Morning Routine?"
- "What tasks did I add last week?"
- "Did I accidentally delete something?"

---

## 2. Cleared Tasks (To-Do Mode)

### Purpose

Maintain a temporary history of completed tasks that have been cleared from active lists. This history exists for progress tracking, achievements, and optional task recreation — not long-term storage.

### When Tasks Are Recorded

- **To-Do Mode only** - When the user presses "Clear Completed Tasks"
- Auto Cycle and Manual Cycle modes do NOT contribute to Cleared Tasks
- Tasks removed via "Mark for Removal" during a cycle reset are NOT recorded here

This ensures:
- Only intentionally cleared tasks count toward task-based achievements
- Users don't feel "cheated" by invisible clears
- The action is deliberate, not automatic

### Entry Structure

```javascript
{
  text: "Buy groceries",
  routine: "Shopping List",
  clearedAt: "2026-01-05T10:30:00.000Z",
  priority: "high",          // optional metadata (if high priority)
  wasRecurring: false        // optional metadata
}
```

### Behavior

| Aspect | Behavior |
|--------|----------|
| **Default view** | Read-only list of cleared tasks |
| **How entries appear** | Only after user clears completed tasks |
| **Recreation** | Optional, manual, intentional |
| **Recreation target** | Current active routine |
| **Recreation mode** | Inherits current routine's mode |
| **After recreation** | Entry removed from cleared list, new task added to active list |
| **Re-completion** | If recreated and cleared again, counts again |
| **Retention** | 90 days - auto-prune older entries |
| **Advanced option** | User may opt out of auto-pruning |
| **Counter** | `totalCleared` persists through prune/recreate/clear |

### Recreation Flow

```
User in Stats Panel
    ↓
Clicks "Cleared Tasks" section
    ↓
Sees static list of cleared tasks (newest first)
    ↓
Clicks "Recreate Tasks" button
    ↓
List converts to checkboxes
    ↓
User selects tasks to recreate
    ↓
Clicks "Recreate Selected"
    ↓
New tasks added to active routine
    ↓
Removed from cleared list
    ↓
Confirmation notification
```

**Important:** Recreation creates NEW tasks based on the cleared history. It does not restore original task objects or their state. This is a conversion, not a retrieval.

### Design Philosophy

- **Recreation should be rare** - miniCycle is a routine manager, not a to-do app
- **Safety net** - Catches accidental clears
- **90-day limit** - If you haven't needed it in 3 months, you won't
- **Gamification fuel** - Primary purpose is progress tracking
- **Forward motion** - Tasks are cleared and counted, not stored and retrieved

---

## 3. Achievement History

### Purpose

App-wide achievement tracking that shows all milestones reached across both cycle completions AND tasks cleared.

### Achievement Types

#### Cycle-Based Achievements (Existing)
| Milestone | Name | Reward |
|-----------|------|--------|
| 5 cycles | "Getting Started" | - |
| 10 cycles | "Building Habits" | - |
| 25 cycles | "Consistent" | Dark Ocean Theme |
| 50 cycles | "Dedicated" | Golden Glow Theme |
| 75 cycles | "Committed" | - |
| 100 cycles | "Century" | Whack-a-Order Game |
| 200 cycles | "Unstoppable" | - |
| 500 cycles | "Legendary" | - |
| 1000 cycles | "Grandmaster" | - |

#### Task-Based Achievements (New - To-Do Mode)
| Milestone | Name | Equivalent Cycles |
|-----------|------|-------------------|
| 5 tasks | "First Five" | 5 |
| 100 tasks | "Productive" | 25 |
| 250 tasks | "Task Master" | 50 |
| 350 tasks | "Getting Things Done" | 75 |
| 500 tasks | "Completionist" | 100 |

### OR-Based Milestones

Achievements can be earned via EITHER path:

```
Badge "Getting Started" unlocked by:
  - 5 cycles completed OR 5 tasks cleared

Badge "Consistent" unlocked by:
  - 25 cycles completed OR 100 tasks cleared

Badge "Dedicated" unlocked by:
  - 50 cycles completed OR 250 tasks cleared
  - Unlocks: Golden Glow Theme

Badge "Century" / "Completionist" unlocked by:
  - 100 cycles completed OR 500 tasks cleared
  - Unlocks: Whack-a-Order Game
```

### Achievement Entry Structure

```javascript
{
  id: "dedicated",
  name: "Dedicated",
  unlockedAt: "2026-01-05T10:30:00.000Z",
  unlockedVia: "cycles",  // or "tasks"
  value: 50,              // cycles or tasks at time of unlock
  reward: "Golden Glow Theme"  // or null
}
```

### Achievement History View

Shows chronological list of achievements earned:

```
Achievement History

[Trophy] Dedicated                    Jan 5, 2026
         50 cycles completed
         Reward: Golden Glow Theme

[Trophy] Consistent                   Dec 15, 2025
         100 tasks cleared
         Reward: Dark Ocean Theme

[Trophy] Getting Started              Nov 1, 2025
         5 cycles completed
```

---

## 4. Schema Additions

### Storage Strategy

| Data | Storage | Why |
|------|---------|-----|
| `history` | **Per-routine** (inside cycle object) | Travels with .mcyc export |
| `clearedTasks` | **Per-routine** (inside cycle object) | Travels with .mcyc export |
| `achievements` | **Global** (root level) | App-wide personal progress |

**Why per-routine for history & cleared tasks:**
- When user exports a routine as .mcyc, the history and cleared tasks travel with it
- Importing on another device preserves the routine's full context
- Each routine owns its own activity log and cleared task history

**Why global for achievements:**
- Achievements are personal app-wide progress, not routine-specific
- "100 cycles completed" counts ALL routines, not just one
- Achievements stay on the device, not in exported files

### Schema Changes

#### Per-Routine Fields (inside each cycle object)

```javascript
// Inside data.cycles["cycle-abc123"]
{
  id: "cycle-abc123",
  name: "Shopping List",
  tasks: [...],
  cycleCount: 42,
  // ... existing fields ...

  // NEW: Per-routine history
  history: {
    events: [
      {
        type: "cycle_completed",
        mode: "auto-cycle",
        timestamp: "2026-01-05T10:30:00.000Z"
      },
      {
        type: "task_added",
        taskText: "Buy milk",
        timestamp: "2026-01-05T09:00:00.000Z"
      },
      {
        type: "tasks_cleared",
        count: 5,
        timestamp: "2026-01-05T11:00:00.000Z"
      }
    ]
  },

  // NEW: Per-routine cleared tasks (To-Do Mode only)
  clearedTasks: {
    entries: [
      {
        text: "Buy groceries",
        clearedAt: "2026-01-05T10:30:00.000Z",
        priority: "high"
      }
    ],
    totalCleared: 47,          // Per-routine count
    autoPruneEnabled: true
  }
}
```

#### Global Fields (root level)

```javascript
// Add to Schema 2.5 root level
{
  // ... existing schema ...

  // NEW: Global achievements (app-wide)
  achievements: {
    unlocked: [
      {
        id: "dedicated",
        name: "Dedicated",
        unlockedAt: "2026-01-05T10:30:00.000Z",
        unlockedVia: "cycles",
        value: 50,
        reward: "Golden Glow Theme"
      }
    ],
    // Global progress counters (sum of all routines)
    totalCyclesCompleted: 50,
    totalTasksCleared: 147
  }
}
```

### Types.js Additions

```javascript
// ============================================
// PER-ROUTINE TYPES (stored inside each cycle)
// ============================================

/**
 * @typedef {Object} HistoryEvent
 * @property {string} type - Event type (cycle_completed, task_added, tasks_cleared, etc.)
 * @property {string} [mode] - Mode at time of event
 * @property {string} timestamp - ISO timestamp
 * @property {string} [taskText] - Task text (for task events)
 * @property {string} [oldText] - Old text (for task_edited)
 * @property {string} [newText] - New text (for task_edited)
 * @property {string} [oldMode] - Old mode (for mode_changed)
 * @property {string} [newMode] - New mode (for mode_changed)
 * @property {number} [count] - Count (for tasks_cleared)
 */
// Note: No 'routine' field needed - history is stored per-routine

/**
 * @typedef {Object} RoutineHistory
 * @property {HistoryEvent[]} events - Array of history events for this routine
 */

/**
 * @typedef {Object} ClearedTaskEntry
 * @property {string} text - Task text
 * @property {string} clearedAt - ISO timestamp
 * @property {string} [priority] - "high" if was high priority
 * @property {boolean} [wasRecurring] - If task was recurring
 */
// Note: No 'routine' field needed - cleared tasks stored per-routine

/**
 * @typedef {Object} RoutineClearedTasks
 * @property {ClearedTaskEntry[]} entries - Cleared task entries for this routine
 * @property {number} totalCleared - Total tasks cleared in this routine (persists)
 * @property {boolean} [autoPruneEnabled=true] - Auto-prune after 90 days
 */

// ============================================
// GLOBAL TYPES (stored at root level)
// ============================================

/**
 * @typedef {Object} AchievementEntry
 * @property {string} id - Achievement ID
 * @property {string} name - Display name
 * @property {string} unlockedAt - ISO timestamp
 * @property {string} unlockedVia - "cycles" or "tasks"
 * @property {number} value - Value at time of unlock
 * @property {string|null} reward - Reward description or null
 */

/**
 * @typedef {Object} Achievements
 * @property {AchievementEntry[]} unlocked - Unlocked achievements (app-wide)
 * @property {number} totalCyclesCompleted - Sum of all routine cycle counts
 * @property {number} totalTasksCleared - Sum of all routine cleared task counts
 */

// ============================================
// UPDATED CYCLE TYPE (add history & clearedTasks)
// ============================================

/**
 * @typedef {Object} Cycle
 * @property {string} id - Unique cycle identifier
 * @property {string} name - Display name
 * @property {Task[]} tasks - Array of tasks
 * @property {number} cycleCount - Times completed
 * @property {boolean} autoReset - Auto-reset on completion
 * @property {boolean} deleteCheckedTasks - Delete tasks when checked
 * @property {Object} recurringTemplates - Recurring task templates
 * @property {Object} taskOptionButtons - Per-cycle button visibility
 * @property {number} createdAt - Creation timestamp
 * @property {number} lastModified - Last modification timestamp
 * @property {RoutineHistory} [history] - Activity history for this routine
 * @property {RoutineClearedTasks} [clearedTasks] - Cleared tasks for this routine
 */
```

---

## 5. UI Design

### Stats Panel Layout

```
┌─────────────────────────────────────────┐
│  Stats                                  │
├─────────────────────────────────────────┤
│                                         │
│  [Current Routine]  ▼                   │
│  ─────────────────────                  │
│  Tasks: 4/7 complete                    │
│  Cycles: 42                             │
│  Progress: ████████░░ 57%               │
│                                         │
│  ┌─────────┐ ┌─────────┐               │
│  │ History │ │ Cleared │  ← Per-routine │
│  │         │ │  Tasks  │                │
│  └─────────┘ └─────────┘               │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  [Milestone Rewards]  ▲                 │
│  ─────────────────────                  │
│  Next: 50 cycles (8 more)               │
│  OR: 250 tasks cleared (103 more)       │
│  Reward: Golden Glow Theme              │
│                                         │
│  [5] [25] [50] [75] [100]              │
│   ✓    ✓   ░    ░    ░                 │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │         Achievements             │  │
│  │         (App-Wide)               │  │ ← Always visible
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Information Architecture

| Section | Scope | Storage | In .mcyc Export? |
|---------|-------|---------|------------------|
| **History** | Per-routine | Inside cycle object | Yes |
| **Cleared Tasks** | Per-routine | Inside cycle object | Yes |
| **Achievements** | App-wide | Root level | No |

**Why this separation:**
- History shows events for the *active* routine only
- Cleared Tasks shows tasks cleared from the *active* routine only
- Achievements track progress across *all* routines (cycles + tasks)

**.mcyc Export Behavior:**
- Exporting a routine includes its history and cleared tasks
- Importing on another device preserves the routine's full context
- Achievements do NOT export (they're personal device progress)
- Global counters (`totalCyclesCompleted`, `totalTasksCleared`) recalculate from all routines

**Notes:**
- "Cleared Tasks" button only appears after entries exist for that routine
- Switching routines updates History and Cleared Tasks views
- Achievements remain constant regardless of active routine

### History Panel

```
┌─────────────────────────────────────────┐
│  ← History                  [Clear All] │
├─────────────────────────────────────────┤
│                                         │
│  Today                                  │
│  ──────                                 │
│  ✓ Cycle completed                      │
│    Morning Routine (Auto Cycle)         │
│    10:30 AM                             │
│                                         │
│  ☐ 5 tasks cleared                      │
│    Shopping List (To-Do Mode)           │
│    11:00 AM                             │
│                                         │
│  + Task added                           │
│    "Call dentist" → Shopping            │
│    9:15 AM                              │
│                                         │
│  Yesterday                              │
│  ─────────                              │
│  ✓ Cycle completed                      │
│    Evening Routine (Manual Cycle)       │
│    8:45 PM                              │
│                                         │
│  ✏ Task edited                          │
│    "Meeting" → "Team standup"           │
│    Work Tasks                           │
│    2:30 PM                              │
│                                         │
│  [Load More...]                         │
│                                         │
└─────────────────────────────────────────┘
```

### Cleared Tasks Panel

#### Default State (Read-Only)
```
┌─────────────────────────────────────────┐
│  ← Cleared Tasks           [Recreate]   │
├─────────────────────────────────────────┤
│                                         │
│  Total Cleared: 147                     │
│  Showing last 90 days                   │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  Buy groceries                          │
│  Shopping List • Jan 5                  │
│                                         │
│  Call insurance company                 │
│  Errands • Jan 4                        │
│                                         │
│  Schedule car maintenance               │
│  Errands • Jan 3                        │
│                                         │
│  [Load More...]                         │
│                                         │
│                    [Clear Cleared List] │
└─────────────────────────────────────────┘
```

#### Recreate Mode (Interactive)
```
┌─────────────────────────────────────────┐
│  ← Cleared Tasks             [Cancel]   │
├─────────────────────────────────────────┤
│                                         │
│  Select tasks to recreate:              │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  ☑ Buy groceries                        │
│    Shopping List • Jan 5                │
│                                         │
│  ☐ Call insurance company               │
│    Errands • Jan 4                      │
│                                         │
│  ☑ Schedule car maintenance             │
│    Errands • Jan 3                      │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  Recreate in: Morning Routine (current) │
│                                         │
│           [Recreate 2 Selected]         │
│                                         │
└─────────────────────────────────────────┘
```

### Achievement History Panel

```
┌─────────────────────────────────────────┐
│  ← Achievement History                  │
├─────────────────────────────────────────┤
│                                         │
│  Your Achievements                      │
│  ─────────────────                      │
│                                         │
│  🏆 Dedicated                           │
│     50 cycles completed                 │
│     Unlocked: Jan 5, 2026               │
│     Reward: Golden Glow Theme           │
│                                         │
│  🏆 Consistent                          │
│     100 tasks cleared                   │
│     Unlocked: Dec 15, 2025              │
│     Reward: Dark Ocean Theme            │
│                                         │
│  🏆 Building Habits                     │
│     10 cycles completed                 │
│     Unlocked: Nov 10, 2025              │
│                                         │
│  🏆 First Five                          │
│     5 tasks cleared                     │
│     Unlocked: Nov 1, 2025               │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  Upcoming                               │
│  ────────                               │
│  ░ Century: 100 cycles (50 more)        │
│  ░ Completionist: 500 tasks (353 more)  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Gamification Integration

### Milestone Mapping

| Badge Level | Cycles Required | Tasks Required | Reward |
|-------------|-----------------|----------------|--------|
| 1 | 5 | 5 | - |
| 2 | 10 | 25 | - |
| 3 | 25 | 100 | Dark Ocean Theme |
| 4 | 50 | 250 | Golden Glow Theme |
| 5 | 75 | 350 | - |
| 6 | 100 | 500 | Whack-a-Order Game |
| 7 | 200 | 1000 | - |
| 8 | 500 | 2500 | - |
| 9 | 1000 | 5000 | - |

### Achievement Check Logic

```javascript
function checkAchievements(totalCycles, totalTasksCleared) {
  const milestones = [
    { id: 'getting_started', cycles: 5, tasks: 5, name: 'Getting Started' },
    { id: 'building_habits', cycles: 10, tasks: 25, name: 'Building Habits' },
    { id: 'consistent', cycles: 25, tasks: 100, name: 'Consistent', reward: 'Dark Ocean Theme' },
    { id: 'dedicated', cycles: 50, tasks: 250, name: 'Dedicated', reward: 'Golden Glow Theme' },
    { id: 'committed', cycles: 75, tasks: 350, name: 'Committed' },
    { id: 'century', cycles: 100, tasks: 500, name: 'Century', reward: 'Whack-a-Order Game' },
    // ... more milestones
  ];

  for (const milestone of milestones) {
    if (alreadyUnlocked(milestone.id)) continue;

    // OR logic - either path unlocks the achievement
    const cycleQualified = totalCycles >= milestone.cycles;
    const taskQualified = totalTasksCleared >= milestone.tasks;

    if (cycleQualified || taskQualified) {
      unlockAchievement({
        id: milestone.id,
        name: milestone.name,
        unlockedVia: cycleQualified ? 'cycles' : 'tasks',
        value: cycleQualified ? totalCycles : totalTasksCleared,
        reward: milestone.reward
      });
    }
  }
}
```

### Notification Flow

```
User clears completed tasks in To-Do Mode
    ↓
Tasks recorded to clearedTasks.entries
    ↓
totalCleared incremented
    ↓
History event logged (tasks_cleared)
    ↓
checkAchievements(totalCycles, totalCleared)
    ↓
If milestone reached:
    ↓
Show notification: "Achievement Unlocked: Consistent!"
    ↓
If reward:
    ↓
Show notification: "New theme unlocked: Dark Ocean!"
    ↓
Update achievements.unlocked array
```

---

## 7. Storage Considerations

### Size Estimates

| Data | Per Entry | 90-Day Estimate | Notes |
|------|-----------|-----------------|-------|
| History event | ~150 bytes | ~50KB | ~10 events/day |
| Cleared task | ~100 bytes | ~30KB | ~10 tasks/day |
| Achievement | ~200 bytes | ~2KB | Max ~9 achievements |

**Total estimate:** ~80-100KB for active users over 90 days

### Pruning Strategy

```javascript
// Run on app boot
function pruneClearedTasks() {
  const state = AppState.get();

  // Check if user disabled auto-pruning
  if (state.clearedTasks?.autoPruneEnabled === false) {
    return;
  }

  const RETENTION_DAYS = 90;
  const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

  AppState.update(state => {
    state.clearedTasks.entries = state.clearedTasks.entries.filter(
      entry => new Date(entry.clearedAt).getTime() > cutoff
    );
    // Note: totalCleared is NOT decremented
  });
}
```

### History Pruning (Optional)

If history grows too large, consider:
- Keep last 500 events
- Or last 180 days
- Or let user clear manually (current plan)

### Storage Visibility

- Cleared tasks storage usage visible in routine storage breakdown
- User explicitly owns retention decision via advanced setting

---

## 8. Implementation Plan

### Phase 1: Schema & Data Layer (Day 1)

- [ ] Add type definitions to `types.js`
- [ ] Update schema documentation
- [ ] Add default empty structures to `appState.js` initialization
- [ ] Write unit tests for new data structures

### Phase 2: History Feature (Day 2)

- [ ] Create `modules/features/historyManager.js`
- [ ] Add history event logging to:
  - `taskCRUD.js` (task added/deleted/edited)
  - `cycleCompletion.js` (cycle completed)
  - `routineManager.js` (routine created/deleted/renamed)
  - `modeManager.js` (mode changed)
  - To-Do Mode clear action (tasks_cleared)
- [ ] Create history panel UI in stats panel
- [ ] Add "Clear History" functionality
- [ ] Write tests for history logging

### Phase 3: Cleared Tasks Feature (Day 3)

- [ ] Create `modules/features/clearedTasksManager.js`
- [ ] Hook into To-Do Mode "Clear Completed Tasks" action
- [ ] Create cleared tasks panel UI
- [ ] Implement recreate mode (checkbox conversion)
- [ ] Implement recreate functionality (creates new tasks)
- [ ] Add 90-day pruning on boot (with opt-out setting)
- [ ] Write tests for clearing and recreation

### Phase 4: Achievement System (Day 4)

- [ ] Create `modules/features/achievementManager.js`
- [ ] Implement OR-based milestone checking
- [ ] Hook into cycle completion and task clearing
- [ ] Create achievement history panel UI
- [ ] Integrate with existing theme/game unlocking
- [ ] Add achievement notifications
- [ ] Write tests for achievement logic

### Phase 5: Integration & Polish (Day 5)

- [ ] Integrate all three panels into stats panel
- [ ] Add navigation between panels
- [ ] Update milestone rewards display to show OR paths
- [ ] Update "Delete When Complete" to "Mark for Removal" terminology
- [ ] Performance testing with large datasets
- [ ] Mobile UI testing
- [ ] Accessibility review

### Phase 6: Documentation & Release (Day 6)

- [ ] Update FEATURE_LIST.md
- [ ] Update SCHEMA_2_5.md (or create SCHEMA_2_5_1.md)
- [ ] Update USER_GUIDE.md
- [ ] Update CHANGELOG.md
- [ ] Update existing docs to use "Mark for Removal" instead of "Delete When Complete"
- [ ] Final testing pass
- [ ] Version bump and deploy

---

## 9. Testing Requirements

### Unit Tests

**History Manager:**
- [ ] Logs cycle_completed event correctly
- [ ] Logs task_added/deleted/edited events
- [ ] Logs tasks_cleared event with count
- [ ] Logs routine_created/deleted/renamed events
- [ ] Logs mode_changed events
- [ ] Clear history removes all events
- [ ] Events have correct timestamps

**Cleared Tasks Manager:**
- [ ] Records tasks when "Clear Completed Tasks" pressed in To-Do Mode
- [ ] Does NOT record in Auto/Manual Cycle modes
- [ ] Does NOT record "Mark for Removal" tasks during reset
- [ ] Prunes entries older than 90 days (when enabled)
- [ ] Does NOT prune when autoPruneEnabled is false
- [ ] totalCleared persists after prune
- [ ] Recreate adds NEW task to active routine
- [ ] Recreate removes entry from cleared list
- [ ] totalCleared unchanged after recreate
- [ ] Re-clearing recreated task increments totalCleared

**Achievement Manager:**
- [ ] Unlocks at correct cycle thresholds
- [ ] Unlocks at correct task thresholds
- [ ] OR logic works (cycles OR tasks)
- [ ] Does not duplicate achievements
- [ ] Records unlockedVia correctly
- [ ] Triggers reward unlocks (themes, games)

### Integration Tests

- [ ] Full flow: complete tasks in To-Do Mode → clear → recorded → milestone → notification
- [ ] Full flow: complete cycle → milestone → theme unlock
- [ ] Recreate flow: clear → recreate mode → select → recreate → verify NEW task in list
- [ ] History flow: add task → edit task → delete task → verify all logged
- [ ] Stats panel navigation between all three panels
- [ ] Data persists across page reload
- [ ] "Mark for Removal" tasks NOT recorded to cleared tasks

### Manual Testing Checklist

- [ ] Complete and clear tasks in To-Do Mode, verify recorded
- [ ] Complete cycles, verify history logging
- [ ] Reach milestone via tasks cleared, verify achievement
- [ ] Reach milestone via cycles, verify achievement
- [ ] Recreate cleared task, verify NEW task in active list
- [ ] Clear history, verify empty
- [ ] Clear cleared tasks list, verify totalCleared unchanged
- [ ] Disable auto-prune, verify entries persist past 90 days
- [ ] Test on mobile (iOS Safari, Chrome)
- [ ] Test offline functionality
- [ ] Verify 90-day pruning works when enabled

---

## 10. Terminology Reference

### Unified Vocabulary

| Term | Usage |
|------|-------|
| **Cleared** | Tasks removed via "Clear Completed Tasks" in To-Do Mode |
| **Clear Completed Tasks** | Button in To-Do Mode |
| **Cleared Tasks** | History section in stats panel |
| **tasks cleared** | Achievement language |
| **clearedAt** | Schema field |
| **Recreate** | Action to add task back (not "Restore") |
| **Mark for Removal** | Per-task option (formerly "Delete When Complete") |

### What "Mark for Removal" Means

Tasks marked for removal are deleted during cycle reset in Auto/Manual Cycle modes. They are NOT recorded to Cleared Tasks history because:
- They're part of the routine cycle flow, not one-time completions
- The user chose to exclude them from the routine going forward
- Recording them would conflate "routine cleanup" with "task completion"

Only explicitly cleared To-Do Mode tasks count toward gamification.

---

## 11. Future Considerations

### Potential Enhancements

1. **Export History** - Download history as CSV/JSON
2. **History Search** - Filter by routine, date, event type
3. **Achievement Sharing** - Share achievements to social media
4. **Custom Milestones** - User-defined achievement goals
5. **Statistics Dashboard** - Charts showing completion trends
6. **Streak Tracking** - Daily/weekly completion streaks (uses existing schema placeholder)

### Schema Evolution

This feature uses additive schema changes only. No migration required - missing fields default to empty structures. Future Schema 2.6 can incorporate these as standard fields.

---

## Summary

| Feature | Purpose | Gamification | Notes |
|---------|---------|--------------|-------|
| **History** | Activity audit trail | None (informational) | All modes |
| **Cleared Tasks** | Temporary completion history | Feeds task-based milestones | To-Do Mode only |
| **Achievement History** | Unified progress tracking | OR-based (cycles OR tasks) | App-wide |

This system gives To-Do Mode users first-class gamification support while maintaining the routine-focused nature of miniCycle for Auto/Manual Cycle users.

**Key Design Principles:**
- Clearing, not archiving
- Forward motion, not storage
- Temporary ledger, not permanent vault
- Recreation, not restoration
- One vocabulary throughout

---

**Created:** January 5, 2026
**Updated:** January 5, 2026
**Author:** Brainstorm session with Claude
**Status:** Ready for implementation when prioritized
