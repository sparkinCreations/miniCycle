# History, Archived Tasks & Achievement System Plan

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 4-6 days
**Breaking Changes:** No (schema additions only)

---

## Overview

This document outlines three interconnected features that enhance progress tracking and gamification in miniCycle:

1. **History** - Activity log tracking routine/task changes across all modes
2. **Archived Tasks** - Completed todo-mode tasks with optional restore capability
3. **Achievement History** - App-wide achievement/milestone tracking

These features work together to:
- Give Todo Mode users visible progress and gamification rewards
- Provide an activity audit trail for all routine changes
- Create a unified achievement system that rewards both cycle completions AND task completions

---

## Table of Contents

1. [History (Activity Log)](#1-history-activity-log)
2. [Archived Tasks](#2-archived-tasks)
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
  newMode: "todo-mode"          // For mode_changed
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

## 2. Archived Tasks

### Purpose

Store completed Todo Mode tasks with optional restore capability. Feeds into gamification milestones.

### When Tasks Are Archived

- **Todo Mode only** - When a task is completed (checked) and removed from the list
- Auto Cycle and Manual Cycle modes do NOT archive (tasks reset, not delete)

### Entry Structure

```javascript
{
  text: "Buy groceries",
  routine: "Shopping List",
  completedAt: "2026-01-05T10:30:00.000Z"
}
```

### Behavior

| Aspect | Behavior |
|--------|----------|
| **Default view** | Static read-only list |
| **Restore mode** | Click "Restore" → checkboxes appear → select → restore |
| **Restore target** | Currently active routine (regardless of original) |
| **Restore mode** | Inherits current routine's mode |
| **After restore** | Entry removed from archive, task added to active list |
| **Re-completion** | If restored and completed again, counts again |
| **Retention** | 90 days - auto-prune older entries |
| **Counter** | `totalArchived` persists through prune/restore |

### Restore Flow

```
User in Stats Panel
    ↓
Clicks "Archived Tasks" section
    ↓
Sees static list of archived tasks (newest first)
    ↓
Clicks "Restore Tasks" button
    ↓
List converts to checkboxes
    ↓
User selects tasks to restore
    ↓
Clicks "Restore Selected"
    ↓
Tasks added to active routine
    ↓
Removed from archive
    ↓
Confirmation notification
```

### Design Philosophy

- **Restore should be rare** - miniCycle is a routine manager, not a todo app
- **Safety net** - Catches accidental deletions
- **90-day limit** - If you haven't needed it in 3 months, you won't
- **Gamification fuel** - Primary purpose is progress tracking

---

## 3. Achievement History

### Purpose

App-wide achievement tracking that shows all milestones reached across both cycle completions AND task archival.

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

#### Task-Based Achievements (New - Todo Mode)
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
  - 5 cycles completed OR 5 tasks archived

Badge "Consistent" unlocked by:
  - 25 cycles completed OR 100 tasks archived

Badge "Dedicated" unlocked by:
  - 50 cycles completed OR 250 tasks archived
  - Unlocks: Golden Glow Theme

Badge "Century" / "Completionist" unlocked by:
  - 100 cycles completed OR 500 tasks archived
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
         100 tasks archived
         Reward: Dark Ocean Theme

[Trophy] Getting Started              Nov 1, 2025
         5 cycles completed
```

---

## 4. Schema Additions

### New Top-Level Fields

```javascript
// Add to Schema 2.5 (no migration needed - new optional fields)
{
  // ... existing schema ...

  history: {
    events: [
      {
        type: "cycle_completed",
        routine: "Morning Routine",
        mode: "auto-cycle",
        timestamp: "2026-01-05T10:30:00.000Z"
      },
      {
        type: "task_added",
        routine: "Shopping",
        taskText: "Buy milk",
        timestamp: "2026-01-05T09:00:00.000Z"
      }
      // ... more events
    ]
  },

  archivedTasks: {
    entries: [
      {
        text: "Buy groceries",
        routine: "Shopping List",
        completedAt: "2026-01-05T10:30:00.000Z"
      }
    ],
    totalArchived: 147  // Persists through prune/restore/clear
  },

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
    // Progress tracking
    totalCyclesCompleted: 50,    // Already exists in userProgress
    totalTasksArchived: 147      // Mirror of archivedTasks.totalArchived
  }
}
```

### Types.js Additions

```javascript
/**
 * @typedef {Object} HistoryEvent
 * @property {string} type - Event type (cycle_completed, task_added, etc.)
 * @property {string} routine - Routine name
 * @property {string} [mode] - Mode at time of event
 * @property {string} timestamp - ISO timestamp
 * @property {string} [taskText] - Task text (for task events)
 * @property {string} [oldText] - Old text (for task_edited)
 * @property {string} [newText] - New text (for task_edited)
 * @property {string} [oldName] - Old name (for routine_renamed)
 * @property {string} [newName] - New name (for routine_renamed)
 * @property {string} [oldMode] - Old mode (for mode_changed)
 * @property {string} [newMode] - New mode (for mode_changed)
 */

/**
 * @typedef {Object} History
 * @property {HistoryEvent[]} events - Array of history events
 */

/**
 * @typedef {Object} ArchivedTaskEntry
 * @property {string} text - Task text
 * @property {string} routine - Routine it came from
 * @property {string} completedAt - ISO timestamp
 */

/**
 * @typedef {Object} ArchivedTasks
 * @property {ArchivedTaskEntry[]} entries - Archived task entries
 * @property {number} totalArchived - Total tasks ever archived (persists)
 */

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
 * @property {AchievementEntry[]} unlocked - Unlocked achievements
 * @property {number} totalCyclesCompleted - Total cycles completed
 * @property {number} totalTasksArchived - Total tasks archived
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
├─────────────────────────────────────────┤
│                                         │
│  [Milestone Rewards]  ▲                 │
│  ─────────────────────                  │
│  Next: 50 cycles (8 more)               │
│  OR: 250 tasks archived (103 more)      │
│  Reward: Golden Glow Theme              │
│                                         │
│  [5] [25] [50] [75] [100]              │
│   ✓    ✓   ░    ░    ░                 │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │ History │ │Archived │ │Achieve-  │  │
│  │         │ │  Tasks  │ │  ments   │  │
│  └─────────┘ └─────────┘ └──────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

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

### Archived Tasks Panel

#### Default State (Read-Only)
```
┌─────────────────────────────────────────┐
│  ← Archived Tasks           [Restore]   │
├─────────────────────────────────────────┤
│                                         │
│  Total Archived: 147                    │
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
│                        [Clear Archived] │
└─────────────────────────────────────────┘
```

#### Restore Mode (Interactive)
```
┌─────────────────────────────────────────┐
│  ← Archived Tasks            [Cancel]   │
├─────────────────────────────────────────┤
│                                         │
│  Select tasks to restore:               │
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
│  Restore to: Morning Routine (current)  │
│                                         │
│            [Restore 2 Selected]         │
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
│     100 tasks archived                  │
│     Unlocked: Dec 15, 2025              │
│     Reward: Dark Ocean Theme            │
│                                         │
│  🏆 Building Habits                     │
│     10 cycles completed                 │
│     Unlocked: Nov 10, 2025              │
│                                         │
│  🏆 First Five                          │
│     5 tasks archived                    │
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
function checkAchievements(totalCycles, totalTasksArchived) {
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
    const taskQualified = totalTasksArchived >= milestone.tasks;

    if (cycleQualified || taskQualified) {
      unlockAchievement({
        id: milestone.id,
        name: milestone.name,
        unlockedVia: cycleQualified ? 'cycles' : 'tasks',
        value: cycleQualified ? totalCycles : totalTasksArchived,
        reward: milestone.reward
      });
    }
  }
}
```

### Notification Flow

```
User completes task in Todo Mode
    ↓
Task archived → totalArchived++
    ↓
checkAchievements(totalCycles, totalArchived)
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
| Archived task | ~100 bytes | ~30KB | ~10 tasks/day |
| Achievement | ~200 bytes | ~2KB | Max ~9 achievements |

**Total estimate:** ~80-100KB for active users over 90 days

### Pruning Strategy

```javascript
// Run on app boot
function pruneArchivedTasks() {
  const RETENTION_DAYS = 90;
  const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

  AppState.update(state => {
    state.archivedTasks.entries = state.archivedTasks.entries.filter(
      entry => new Date(entry.completedAt).getTime() > cutoff
    );
    // Note: totalArchived is NOT decremented
  });
}
```

### History Pruning (Optional)

If history grows too large, consider:
- Keep last 500 events
- Or last 180 days
- Or let user clear manually (current plan)

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
- [ ] Create history panel UI in stats panel
- [ ] Add "Clear History" functionality
- [ ] Write tests for history logging

### Phase 3: Archived Tasks Feature (Day 3)

- [ ] Create `modules/features/archivedTasksManager.js`
- [ ] Hook into Todo Mode task completion (archive instead of delete)
- [ ] Create archived tasks panel UI
- [ ] Implement restore mode (checkbox conversion)
- [ ] Implement restore functionality
- [ ] Add 90-day pruning on boot
- [ ] Write tests for archival and restore

### Phase 4: Achievement System (Day 4)

- [ ] Create `modules/features/achievementManager.js`
- [ ] Implement OR-based milestone checking
- [ ] Hook into cycle completion and task archival
- [ ] Create achievement history panel UI
- [ ] Integrate with existing theme/game unlocking
- [ ] Add achievement notifications
- [ ] Write tests for achievement logic

### Phase 5: Integration & Polish (Day 5)

- [ ] Integrate all three panels into stats panel
- [ ] Add navigation between panels
- [ ] Update milestone rewards display to show OR paths
- [ ] Performance testing with large datasets
- [ ] Mobile UI testing
- [ ] Accessibility review

### Phase 6: Documentation & Release (Day 6)

- [ ] Update FEATURE_LIST.md
- [ ] Update SCHEMA_2_5.md (or create SCHEMA_2_5_1.md)
- [ ] Update USER_GUIDE.md
- [ ] Update CHANGELOG.md
- [ ] Final testing pass
- [ ] Version bump and deploy

---

## 9. Testing Requirements

### Unit Tests

**History Manager:**
- [ ] Logs cycle_completed event correctly
- [ ] Logs task_added/deleted/edited events
- [ ] Logs routine_created/deleted/renamed events
- [ ] Logs mode_changed events
- [ ] Clear history removes all events
- [ ] Events have correct timestamps

**Archived Tasks Manager:**
- [ ] Archives task on Todo Mode completion
- [ ] Does NOT archive in Auto/Manual Cycle modes
- [ ] Prunes entries older than 90 days
- [ ] totalArchived persists after prune
- [ ] Restore adds task to active routine
- [ ] Restore removes entry from archive
- [ ] totalArchived unchanged after restore
- [ ] Re-completing restored task increments totalArchived

**Achievement Manager:**
- [ ] Unlocks at correct cycle thresholds
- [ ] Unlocks at correct task thresholds
- [ ] OR logic works (cycles OR tasks)
- [ ] Does not duplicate achievements
- [ ] Records unlockedVia correctly
- [ ] Triggers reward unlocks (themes, games)

### Integration Tests

- [ ] Full flow: complete task in Todo Mode → archived → milestone → notification
- [ ] Full flow: complete cycle → milestone → theme unlock
- [ ] Restore flow: archive → restore mode → select → restore → verify in list
- [ ] History flow: add task → edit task → delete task → verify all logged
- [ ] Stats panel navigation between all three panels
- [ ] Data persists across page reload

### Manual Testing Checklist

- [ ] Complete tasks in Todo Mode, verify archival
- [ ] Complete cycles, verify history logging
- [ ] Reach milestone via tasks, verify achievement
- [ ] Reach milestone via cycles, verify achievement
- [ ] Restore archived task, verify in active list
- [ ] Clear history, verify empty
- [ ] Clear archived, verify totalArchived unchanged
- [ ] Test on mobile (iOS Safari, Chrome)
- [ ] Test offline functionality
- [ ] Verify 90-day pruning works

---

## 10. Future Considerations

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

| Feature | Purpose | Gamification |
|---------|---------|--------------|
| **History** | Activity audit trail | None (informational) |
| **Archived Tasks** | Todo Mode completions + restore | Feeds task-based milestones |
| **Achievement History** | Unified progress tracking | OR-based milestones (cycles OR tasks) |

This system gives Todo Mode users first-class gamification support while maintaining the routine-focused nature of miniCycle for Auto/Manual Cycle users.

---

**Created:** January 5, 2026
**Author:** Brainstorm session with Claude
**Status:** Ready for implementation when prioritized
