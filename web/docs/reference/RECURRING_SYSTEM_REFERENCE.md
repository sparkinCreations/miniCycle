# miniCycle Recurring Tasks: Complete User Guide

**Version 1.6 | For miniCycle v2.023+ Users & Developers**

**Last verified:** Nov 10 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).** Code snippets in this guide are simplified pseudocode unless a file is named; the modules under `modules/recurring/` are the source of truth.

_History — the February 2026 revision added: **v2.023 features** - Recurring info link in task list (shows count of recurring tasks, opens panel on click), "Select All" button for bulk adding tasks to recurring, watcher interval reduced from 30s to 15s for faster task appearance, 5 bug fixes (listener leak, cache corruption, missing await, stale DOM data, DOM query in state callback). Plus from v1.349: Monthly week-of-month patterns (2nd Tuesday, Last Friday), End date (Until) option for all frequencies, Monthly last-day handling; Plus from v1.348: Biweekly two-week pattern with separate day selections per week, DST-safe date calculations, clarification of "one task only" catch-up behavior for cycle-based routine management, next occurrence display, catch-up function, two-state notifications, hybrid optimization pattern, immediate appearance for newly-enabled tasks, and schedule recalculation on cycle reset._

---

## Table of Contents

1. [What Makes miniCycle Different](#what-makes-minicycle-different)
2. [Understanding the Cycling Methodology](#understanding-the-cycling-methodology)
3. [How Recurring Tasks Work](#how-recurring-tasks-work)
4. [Complete User Flow](#complete-user-flow)
5. [Technical Architecture](#technical-architecture)
6. [Comparison with Other Apps](#comparison-with-other-apps)
7. [Who Should Use Recurring Tasks](#who-should-use-recurring-tasks)
8. [Alternatives & When to Use Them](#alternatives--when-to-use-them)
9. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## What Makes miniCycle Different

### The Core Philosophy

**miniCycle is cycle-centric, not task-centric.**

Traditional task apps like Todoist, Things, and TickTick treat each task as an independent item. When you complete a task, it's done. If you want it again, you create a new one (or use recurring rules that duplicate tasks).

**miniCycle is built around reusable checklists called "cycles."** When you complete all tasks in a cycle, the entire cycle resets. All your tasks become unchecked and ready to go again. This is perfect for:

- Morning routines
- Quality inspection checklists
- Weekly review processes
- Closing procedures
- Workout programs
- Any repeatable workflow

### The Three Task Patterns

miniCycle offers three distinct patterns for different needs:

| Pattern | When to Use | How It Works |
|---------|-------------|--------------|
| **Reset Tasks** | Tasks that repeat every cycle | Task resets to unchecked when cycle completes |
| **Recurring Tasks** | Tasks that appear on a schedule | Task deletes on reset, reappears based on schedule |
| **Reminder Tasks** | Tasks that need notifications | Task stays visible, reminds you at set times |

**This guide focuses on Recurring Tasks** - the scheduled pattern.

---

## Understanding the Cycling Methodology

### What is a Cycle?

A **cycle** is a complete round of your task list. Think of it like:

- A morning routine cycle (wake up → shower → breakfast → ready for day)
- An inspection checklist cycle (check equipment → document → sign off)
- A closing procedure cycle (count cash → clean → lock up → alarm)

**When you complete all tasks, the cycle completes and resets.**

### What Happens on Reset?

**For regular (non-recurring) tasks:**
- ✅ Task becomes unchecked
- ✅ Task stays in the list
- ✅ Ready to do again next cycle

**For recurring tasks:**
- ❌ Task is **deleted** from the list
- ✅ Task **template** remains saved
- ✅ Template's schedule is **recalculated** from current time (v1.338+)
- ✅ Task **reappears** based on its schedule

**Why delete recurring tasks?** Because they're scheduled to appear at specific times, not every cycle. Deleting them keeps your workflow clean.

### Real-World Example

**Morning Routine Cycle:**
- ☐ Make bed (resets every cycle)
- ☐ Exercise (resets every cycle)
- ☐ Take medication at 9am (recurring - only appears once per day)
- ☐ Review calendar (resets every cycle)

When you complete this cycle at 8am:
- "Make bed" → unchecks, ready for tomorrow
- "Exercise" → unchecks, ready for tomorrow
- "Take medication at 9am" → **deleted**, will reappear at 9am today
- "Review calendar" → unchecks, ready for tomorrow

The medication task disappears because it's scheduled for 9am. It will automatically reappear when 9am arrives.

---

## How Recurring Tasks Work

### The Two-Part System

Recurring tasks use a **template-based architecture** with two storage locations:

#### 1. Task Settings (on the task itself)
```javascript
{
  id: "task-123",
  text: "Take medication",
  recurring: true,
  recurringSettings: {
    frequency: "daily",
    indefinitely: true,
    time: { hour: 9, minute: 0, meridiem: "AM" }
  }
}
```
**Purpose:** Remembers what the settings were, even if you toggle recurring off

#### 2. Recurring Template (on the routine)
```javascript
// state.data.routine[routineId].recurringTemplates — a map keyed by task id
routine.recurringTemplates["task-123"] = {
  id: "task-123",
  text: "Take medication",
  recurring: true,
  recurringSettings: { /* same as above */ },
  dueDate: null, dueTime: null,
  priority: null,                          // 'high' | 'medium' | 'low' | null
  remindersEnabled: false,
  autoClear: { cycle: true, todo: true },  // per-mode clear map (recurring preset)
  occurrenceCount: 0,                      // spawns so far (drives the "N times" limit)
  lastTriggeredTimestamp: 1736931600000,   // epoch ms of the last spawn; null after a reset
  paused: false,                           // true = the watcher skips it until resumed (Oct 2026)
  nextScheduledOccurrence: 1737019200000,  // epoch ms of the next occurrence; null = finished
  position: 1,                             // index in routine.tasks to recreate at (null = append)
  schemaVersion: 2                         // RECURRING_TEMPLATE_SCHEMA_VERSION
}
```
**Purpose:** The "master copy" used to recreate the task on schedule. Includes optimization field for fast checking. Every writer builds this record through `buildRecurringTemplate()` in `modules/recurring/recurringTemplate.js`, so the field set cannot drift between writers. A template with no `nextScheduledOccurrence` reads as finished to the watcher and never fires.

`position` (Sep 2026) is where the recreated instance is inserted in the routine. It is recorded
whenever an instance leaves the task list — cycle reset, To-Do clear — and set at activation and
on `.mcyc` import (the file's task order). Before it existed the watcher always appended, so
every recurring task drifted to the bottom of the routine after each reset.

### The Lifecycle of a Recurring Task

```
1. USER TOGGLES RECURRING ON
   ↓
2. Task gets default settings (daily, indefinite)
   ↓
3. Template created in recurringTemplates
   ↓
4. Quick Actions notification appears
   ↓
5. User adjusts frequency/time (or accepts default)
   ↓
6. Settings saved to both task and template
   
   ═══════════════════════════════════════
   
7. CYCLE COMPLETES (auto or manual)
   ↓
8. Task is DELETED from task list
   ↓
9. Template REMAINS in storage
   
   ═══════════════════════════════════════
   
10. WATCH FUNCTION checks every 15 seconds (INTERVALS.RECURRING_WATCHER)
    ↓
11. Is it time to recreate this task?
    ↓
    YES → Task recreated from template
    NO → Wait for next check
```

### Why Templates?

**Without templates:** When the task is deleted, all its settings are lost.

**With templates:** The task can be deleted (keeping your list clean) while preserving:
- Task text
- Recurring schedule
- Priority level
- Due date (kept in step with the task; cleared when a cycle reset removes the occurrence — see *Due dates* below)
- Reminder settings

This allows the task to be recreated from the template when its schedule says it's time.

---

## Complete User Flow

### Phase 1: Setting Up Recurring

#### Step 1: Toggle Recurring Button

**In the task options menu, click the 🔁 Recurring button:**

```
Before: [ ] Take medication at 9am    [🔁]
                                       ↑ Click here
```

**What happens internally:**
```javascript
// Task is marked as recurring
task.recurring = true;
task.recurringSettings = {
  frequency: "daily",
  indefinitely: true,
  time: null  // Default: no specific time
};

// Template is created (activateTaskRecurringState → buildRecurringTemplate)
routine.recurringTemplates[taskId] = {
  id: taskId,
  text: "Take medication at 9am",
  recurring: true,
  recurringSettings: { /* same as above */ },
  position: /* the task's index in routine.tasks */,
  nextScheduledOccurrence: calculateNextOccurrence(settings, Date.now())
};
```

The task itself stays in the list; it is also set to clear in every mode (`DEFAULT_RECURRING_DELETE_SETTINGS`). If the task was recurring before, its previous `recurringSettings` are reused instead of the defaults (`settings.defaultRecurringSettings`, or daily / indefinitely when none are saved).

#### Step 2: Quick Actions Notification

**Immediately after toggling, you see a clean confirmation:**

```
┌─────────────────────────────────────────┐
│ "Your task text here"                    │
│                                          │
│ 🔁 Recurring set to daily (Indefinitely) ⓘ│
│                                          │
│           [Change Settings]              │
└─────────────────────────────────────────┘

ⓘ Recurring tasks are removed on cycle reset
and will reappear on their schedule
```

**Default state shows:**
- The task text you just made recurring
- Current frequency and pattern
- "Change Settings" button
- An info button (ⓘ) that shows or hides the explanation; the explanation is open the first time and collapsed after that
- Auto-dismisses after 10 seconds (pauses on hover/interaction)

**Click "Change Settings" to expand quick options:**

```
┌─────────────────────────────────────────┐
│ "Your task text here"                    │
│                                          │
│ 🔁 Recurring set to daily (Indefinitely) ⓘ│
│                                          │
│ ○ Hourly   ● Daily   ○ Weekly  ○ Monthly│
│                                          │
│ [Apply]                  [More Options]  │
└─────────────────────────────────────────┘
```

**Now you can:**
- Click a different frequency (hourly, weekly, monthly)
- Click "Apply" to save the quick change
- Click "More Options" to open the full Recurring Panel
- Close the notification (settings are already saved)

#### Step 3: Adjusting Settings (Optional)

**Click "More Options" or open the panel with the "Recurring" button in the main menu:**

```
Recurring Tasks Panel
═══════════════════════════════════

📋 Active Recurring Tasks:

☐ Take medication at 9am
   Current: Daily (indefinite)

[Change Recurring Settings] ← Click here

───────────────────────────────────

Settings Panel (opens when you click):

Frequency: [Daily ▼]

☑ Recur indefinitely
☐ Specific number of times: [__]

☐ Specific time: [9:00] [AM ▼]

[Apply]  [Cancel]
```

**Make your changes:**
1. Check "Specific time"
2. Set time to 9:00 AM
3. Click "Apply"

**What happens:**
```javascript
// Settings updated on task
task.recurringSettings = {
  frequency: "daily",
  indefinitely: true,
  time: { hour: 9, minute: 0, meridiem: "AM" }
};

// Template rebuilt with the new settings and a fresh nextScheduledOccurrence
// (recurringSettingsApplicator.js; keeps paused, occurrenceCount, lastTriggeredTimestamp)
routine.recurringTemplates[taskId].recurringSettings = {
  /* same as above */
};

// Both writes happen inside one AppState.update(), which persists the state
// to localStorage (key "miniCycleData")
```

### Phase 2: Cycle Completion

**You complete all tasks in your cycle:**

```
Morning Routine
═══════════════
✓ Make bed
✓ Exercise
✓ Take medication at 9am
✓ Review calendar

[Progress: 100%]
```

**When cycle completes (auto-reset or manual):**

#### What Happens to Regular Tasks:
```javascript
// Regular tasks reset
tasks.forEach(task => {
  if (!task.recurring) {
    task.completed = false;  // Unchecked, stays visible
  }
});
```

#### What Happens to Recurring Tasks:
```javascript
// Recurring tasks deleted (a recurring task pinned to the list is kept and
// only unchecked — see "Pinned = paused" below)
tasks = tasks.filter(task => !task.recurring);

// Templates remain; each removed task's template gets a recalculated
// nextScheduledOccurrence, lastTriggeredTimestamp = null, and its position
recurringTemplates["task-123"] still exists
```

**Your task list now shows:**
```
Morning Routine
═══════════════
☐ Make bed
☐ Exercise
☐ Review calendar

(No "Take medication" - it's been deleted)
```

### Phase 3: Task Reappears Automatically

**The Watch Function runs every 15 seconds while the active routine has templates (`INTERVALS.RECURRING_WATCHER`), and on tab visibility. With no templates it idles at `INTERVALS.RECURRING_WATCHER_IDLE` (2 hours).** Only the active routine's templates are checked.

```javascript
// Simplified pseudocode with hybrid optimization
// (real code: watchRecurringTasks → recreateDueTasks in recurringWatcher.js)
setInterval(() => {
  const now = Date.now();

  Object.values(recurringTemplates).forEach(template => {

    // Is this task currently in the list?
    const exists = tasks.find(t => t.id === template.id);
    if (exists) return; // Already there, skip

    if (template.paused === true) return;                 // paused in the panel
    if (template.nextScheduledOccurrence == null) return; // finished (count / end date)

    // ========================================
    // HYBRID OPTIMIZATION PATTERN
    // ========================================

    // FAST PATH: Check pre-calculated timestamp
    if (now < template.nextScheduledOccurrence) {
      return; // Not time yet, skip expensive pattern matching
    }

    // SLOW PATH: Validate with pattern matching
    // (This ensures accuracy for complex patterns)
    if (shouldRecreateRecurringTask(template, tasks, now)) {

      // Recreate from template (buildRecurringInstance): text, due date,
      // priority, reminders, settings; always set to clear in every mode
      const newTask = {
        id: template.id,
        text: template.text,
        completed: false,
        recurring: true,
        recurringSettings: template.recurringSettings
      };

      // Inserted at template.position (appended when it is null)
      tasks.splice(template.position ?? tasks.length, 0, newTask);

      // Update the template for the next occurrence
      template.occurrenceCount += 1;
      template.lastTriggeredTimestamp = now;
      template.nextScheduledOccurrence = calculateNextOccurrence(
        template.recurringSettings,
        now
      ); // null once the count limit or the end date is reached

      // One AppState.update(..., { system: true }): saved immediately and
      // kept out of undo history; the task list is then refreshed from state
    }
  });
}, INTERVALS.RECURRING_WATCHER); // 15 seconds

// Also runs on visibility change (catch-up function)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    catchUpMissedRecurringTasks();
    watchRecurringTasks();
  }
});
```

**Why Hybrid Approach?**
- **Fast Path:** Skip pattern matching if `nextScheduledOccurrence` indicates it's not time yet (performance optimization)
- **Slow Path:** The 15-second watch validates with pattern matching before it spawns (for a timed task the current minute must match the schedule)
- **Catch-up is fast path only:** `catchUpMissedRecurringTasks()` spawns any template whose `nextScheduledOccurrence` has passed, without re-matching the pattern. It runs at startup, when a routine is loaded (`routineLoader.js`), when the tab becomes visible, and when a watch tick notices it overslept (the gap since the last tick exceeds `LIMITS.RECURRING_OVERSLEEP_FACTOR` times the interval — device sleep or a frozen tab)
- **Task limit:** a spawn that would exceed `LIMITS.TASKS_PER_CYCLE` is blocked with a one-time warning; its template is not advanced and retries on later ticks

**At 9:00 AM, your list updates:**
```
Morning Routine
═══════════════
☐ Make bed
☐ Exercise
☐ Take medication at 9am  ← Reappeared!
☐ Review calendar
```

### Phase 4: Managing Recurring Tasks

**The "Recurring" button in the main menu (`#open-recurring-panel`) opens the Recurring Tasks panel. It is always shown, because tasks can also be made recurring from inside the panel.**

**Why a panel?** Because recurring tasks get deleted after cycle reset, you need a way to:
- See what's scheduled (even when not visible)
- Modify schedules
- Turn off recurring
- View next occurrence

**Opening the panel shows:**
```
Recurring Tasks
═══════════════════════════════════

📋 Active Recurring Templates:

☐ Take medication at 9am
   📅 Daily at 9:00 AM
   🔄 Occurs indefinitely
   Next: Tomorrow at 9:00 AM

   [Change Settings]  [Remove Recurring]

───────────────────────────────────

[Close]
```

**This is your "backstage view"** - you can see and control recurring tasks even when they're not currently visible in your task list.

**Pause / resume (Oct 2026).** Each row has a pause toggle. A paused template keeps its settings,
schedule and occurrence count, but `recurringWatcher` skips it (`template.paused === true`). Resuming
recomputes `nextScheduledOccurrence` from the moment of resume — there is no catch-up for occurrences
missed while paused, so a task paused for a month does not come back as a backlog. Re-applying
settings (`recurringSettingsApplicator`) preserves the flag. The selected task's summary shows
"Paused — will not recur until resumed" in place of "Appears in…"; the schedule line stays.

**Pinned = paused, derived (Oct 2026).** A recurring task whose instance is in the list and set NOT
to clear in the current mode (Clear on Reset / Marked for Clearing off — 📌) never leaves the list,
and the watcher never spawns a template whose instance is present, so the pin already holds the
schedule. The panel shows it: `getRecurringPauseState(routine, template)` in `recurringTemplate.js`
returns `'manual'` (the user's `paused` flag — always wins), `'pinned'` (`isRecurringPinned`), or
`null`. Nothing is stored for the pin, so unpinning ends it on its own.

**A recurring pin holds in every mode.** A normal task keeps a separate Clear on Reset (cycle modes)
and Marked for Clearing (To-Do) choice; a recurring task does not, because a pause must not switch
off when the routine changes mode. `setAutoClear` writes every key of a recurring task's map;
`getAutoClear` reads a recurring map that is `false` in any mode as pinned in all of them; and
`syncTaskAutoClear` (load, mode switch) repairs a map that disagrees — from before this rule — to
pinned everywhere, the direction that never clears a task the user chose to keep. The watcher builds
a recreated instance clearing in every mode, so a stale `false` on the template cannot spawn it
already pinned.

| Sequence | Panel shows | After unpinning |
|---|---|---|
| Pin (not paused) | "Paused · pinned", resume control faded | Active |
| Pause, then pin | "Paused" (normal) | Still paused — resuming is deliberate |
| Pause, pin, then resume | Pause cleared → "Paused · pinned" | Active |

The faded control is `aria-disabled="true"`, not `disabled`: it stays focusable, and a tap shows
"Unpin it to resume" and changes nothing (`handleTogglePause`) — pausing on top would turn the pin's
hold into a manual one that outlives the pin. A reset's `recurring_tasks_removed` history event names
only the plan's `removedIds`, so a pinned recurring task is no longer logged as removed.

**Remove, with the task put back (Oct 2026).** If the task's instance is not in the list when you
remove its recurrence (its last occurrence was cleared), the confirmation offers "Put the task back in
the list as a normal task", on by default: a stop-recurring that would otherwise lose the task
restores it at the template's recorded `position` as a plain task (no due date, not recurring). If the
instance is in the list, no checkbox: it stays and simply stops recurring.

**Due dates (Oct 2026).** The template's `dueDate` is kept in step with the task (every due-date
write syncs it) and is nulled when a cycle reset clears the instance — the date belonged to that
occurrence. Before this, the date set when recurring was enabled came back on every recurrence.

**Next Occurrence Display:**
miniCycle shows you when each recurring task will appear next using human-readable formatting:
- "Appears in less than 1 minute"
- "Appears in 30 minutes" (within 1 hour)
- "Appears in 3 hours" (within 24 hours)
- "Next: Tomorrow at 9:00 AM" (beyond 24 hours, on tomorrow's date)
- "Next: Wednesday at 2:30 PM" (within the next 7 days)
- "Next: Wed, Jan 15, 2025 at 9:00 AM" (further out)
- "Overdue" (the time has passed and the task has not been recreated yet) and "No upcoming occurrences" (the template has finished)

Times follow the device's own 12/24-hour setting (`formatNextOccurrence()` in `recurringCalculators.js`). This helps you understand your schedule at a glance without mental calculations.

**Recurring Info Link (v2.023+):**
At the bottom of the task list, a clickable info link shows how many recurring templates are active:

```
☐ Make bed
☐ Exercise
☐ Review calendar

🔁 3 tasks set to recurring
```

- Appears automatically when the routine has one or more recurring templates
- Shows the number of recurring templates on the routine (paused ones included)
- Clicking it (or pressing Enter/Space on it) opens the Recurring Tasks panel directly
- Refreshed when recurring is turned on or off for a task (`updateRecurringInfoLink()` in `recurringBoot.js`)
- If all recurring templates are removed, the link disappears

When no tasks are in the list at all but templates exist, the empty-state hint is replaced by the same count followed by "View recurring settings".

**Add Task to Recurring (with Select All):**
The panel includes an "Add Task to Recurring" section at the bottom, letting you convert existing non-recurring tasks into recurring tasks:

```
Select tasks to make recurring:    [Select All]
───────────────────────────────────
☐ Make bed
☐ Exercise
☐ Review calendar

[Confirm: Add 0 tasks to recurring]
```

- Lists all non-recurring tasks in your current routine
- Check individual tasks or use the **Select All** button (v2.023+) to select/deselect all at once
- The Select All button toggles between "Select All" and "Deselect All" based on the current state
- The confirm button shows how many tasks are selected and is hidden when none are selected
- After confirming, every selected task becomes recurring with the default settings (daily, indefinitely) in one step; the panel goes back to its list, where you can select a task to change its schedule (`handleConfirmAddRecurring()` in `recurringPanelAddTask.js`)

---

## Technical Architecture

### Module Organization

The recurring task system lives in `modules/recurring/`. What used to be one large `recurringCore.js` is now a coordinator plus focused sub-modules. For current file sizes and module counts see [PROJECT_STATS.md](../PROJECT_STATS.md).

#### Core Files

**`modules/recurring/recurringCore.js`** - *The Coordinator*
- **Purpose:** Loads the logic sub-modules (dynamic `import()` with version cache-busting), wires them to each other, and re-exports their functions
- **Entry point:** `setRecurringCoreDependencies(overrides)` — stores the dependencies, loads the sub-modules, passes the dependencies on to the watcher and activation modules, and returns the loaded functions
- **Sub-modules it loads:**
  - `recurringDateUtils.js` — date helpers (`getDaysBetween()`, `applyTimeToDate()`, `calculateNthWeekdayOfMonth()`, `parseDateAsLocal()`)
  - `recurringSettings.js` — `normalizeRecurringSettings()` (defaults, allow-lists, memoized)
  - `recurringCalculators.js` — `calculateNextOccurrence()`, `calculateNextOccurrences()`, `formatNextOccurrence()` and one calculator per frequency
  - `recurringMatcher.js` — pattern matching (`shouldTaskRecurNow()`, `shouldRecreateRecurringTask()`)
  - `recurringWatcher.js` — the watch function, the catch-up function and the interval (`setupRecurringWatcher()`, `watchRecurringTasks()`, `catchUpMissedRecurringTasks()`, `restartRecurringWatcher()`)
  - `recurringActivation.js` — turning recurring on and off, template deletion, cycle reset planning (`handleRecurringTaskActivation()`, `handleRecurringTaskDeactivation()`, `applyRecurringToTask()`, `deleteRecurringTemplate()`, `removeRecurringTasksFromCycle()`)
- **Pattern:** `createDIModule` (diBase.js) with late-binding dependencies
- **Why separate?** Scheduling logic is isolated from the DOM so it can be tested on its own

**`modules/recurring/recurringTemplate.js`** - *The Template Shape*
- `buildRecurringTemplate()` is the single definition of a template record
- `syncTemplateFromTask()` / `healTemplatesFromTasks()` keep a template in step with edits to its live task (text, due date, priority, reminder flag)
- `getRecurringPauseState()` / `isRecurringPinned()` answer why a template is not spawning
- `keepBiweeklyStart()` / `withoutBiweeklyStart()` carry or drop the biweekly Week 1 start date

**`modules/recurring/recurringSettingsApplicator.js`** - *Apply from the Panel*
- `applyRecurringSettings(panel, buildSettingsFromPanel)` writes the panel form's settings to the checked tasks and rebuilds their templates

**`modules/recurring/recurringPanel.js`** - *The Interface*
- **Purpose:** UI panel for managing recurring tasks (`RecurringPanelManager`)
- **Responsibilities:**
  - Recurring tasks panel modal
  - Task preview and editing
  - Settings form rendering
  - Pause / resume and remove
  - User interaction handling
- **Sub-modules:** `recurringPanelSetup.js`, `recurringPanelForm.js`, `recurringPanelEvents.js`, `recurringPanelGrids.js`, `recurringPanelSummary.js`, `recurringPanelAddTask.js`
- **Loaded on demand:** the panel and its sub-modules are not loaded at boot; they load the first time the panel is opened (`ensureRecurringPanelLoaded()` inside `recurringIntegration.js`)
- **Why separate?** UI concerns separated from business logic
- The Quick Actions notification is not part of the panel: it is built by `createRecurringNotificationWithTip()` in `modules/utils/notifications.js`

**`modules/recurring/recurringBoot.js`** - *Boot-time UI*
- `updateRecurringButtonVisibility()`, `updateRecurringInfoLink()` and `wireRecurringOpenTriggers()` — the menu button, the info link and the open triggers, which must work before the panel is loaded

**`modules/recurring/recurringIntegration.js`** - *The Glue*
- **Purpose:** Integration layer connecting core and panel to main app
- **Entry point:** `initRecurringModules(options)`. The module is registered in `modules/boot/moduleManifests.js` as `recurringIntegration` (phase `PHASES.RECURRING`, API name `recurring`, provides `panel` and `core`)
- **Responsibilities:**
  - Dependency injection setup
  - One-time repair of templates that drifted from their live task
  - Wiring panel callbacks to core functions
  - Starting the watcher
  - Building the lazy panel object and the `coreAPI` / `panelAPI` wrappers it returns
  - `testRecurringIntegration()` self-check
- **Pattern:** Integration/facade pattern
- **Why separate?** Decouples core logic from app-specific dependencies

#### How They Work Together

```
User Action (UI)
    ↓
moduleLoader.js dependency mappings (deps.recurring.core / deps.recurring.panel)
    ↓
recurringIntegration.js (wiring/setup)
    ↓                    ↓
recurringPanel.js    recurringCore.js → sub-modules
(UI layer, lazy)     (business logic)
    ↓                    ↓
AppState.update() ← Both write here
```

**Initialization Flow:**
1. **App starts** → the module loader (`modules/boot/moduleLoader.js`, driven by `moduleManifests.js`) loads modules phase by phase
2. **Integration loads** → `initRecurringModules()` waits for core (`appInit.waitForCore()`), then imports `recurringCore.js` and `recurringSettingsApplicator.js`
3. **Dependencies configured** → `setRecurringCoreDependencies()` receives AppState and the other dependencies via DI
4. **Watch started** → `setupRecurringWatcher()` runs a catch-up and a watch pass if the active routine has templates, starts the interval and registers the `visibilitychange` listener
5. **Boot UI wired** → menu button, info link and open triggers (`recurringBoot.js`); the panel itself loads on first open
6. **System ready** → User can interact with recurring features

**Data Flow Example (Toggle Recurring ON):**
```
1. User clicks 🔁 button
   → taskDOM.js: setupRecurringButtonHandler() handles the click

2. Call handleRecurringTaskActivation(task, taskContext, button)
   → recurringActivation.js (reached through deps.recurring.core)

3. One AppState.update():
   - Mark task.recurring = true, store the normalized settings
   - Build the template in recurringTemplates
   - Set nextScheduledOccurrence = calculateNextOccurrence(settings, now)
   → activateTaskRecurringState() in recurringActivation.js

4. Show quick actions notification
   → notifications.js: createRecurringNotificationWithTip()

5. Restart the watcher at the active interval, refresh the menu button
   and the info link
   → restartRecurringWatcher(), recurringBoot.js
```

**Scheduling Flow (Watch Function):**
```
Every INTERVALS.RECURRING_WATCHER (15 seconds) while templates exist:

1. watchRecurringTasks() runs
   → recurringWatcher.js

2. Read the active routine's templates and tasks from AppState;
   switch between the active and idle interval

3. If the tick overslept, hand over to catchUpMissedRecurringTasks()

4. For each template (recreateDueTasks()):
   - Skip if present in the list, paused, finished or count-exhausted
   - Fast path: Check nextScheduledOccurrence
   - Slow path: Validate with shouldRecreateRecurringTask()

5. If task should appear:
   - Build the task from the template (buildRecurringInstance())
   - Insert it at the template's position, up to LIMITS.TASKS_PER_CYCLE
   - Advance the template (occurrenceCount, lastTriggeredTimestamp,
     nextScheduledOccurrence)

6. Commit with AppState.update(..., { system: true })
   → saved immediately, kept out of undo history
```

#### Why This Organization?

**Separation of Concerns:**
- **Core + sub-modules:** scheduling logic; the calculators, matcher, settings and date utilities touch no DOM
- **Panel:** UI/UX, form handling, user feedback
- **Integration:** App-specific wiring, keeps core reusable

**Dependency Injection:**
```javascript
// recurringCore.js declares its dependencies with diBase
const di = createDIModule('RecurringCore', {
  appInit: optional(null),
  AppState: optional(null),        // Injected by integration
  updateAppState: optional(null),  // Injected by integration
  now: optional(null),             // Mockable for testing
  // ... other dependencies
});

// recurringIntegration.js wires them up (inside initRecurringModules)
const coreFunctions = await recurringCore.setRecurringCoreDependencies({
  AppMeta: options.AppMeta,
  appInit: deps.appInit,
  AppState: deps.AppState,
  updateAppState: (updateFn, immediate = false, options) =>
    deps.AppState.update(updateFn, immediate, options),
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  isEnabled: () => deps.FeatureFlags?.recurringEnabled !== false,
  // ... notifications, DOM access, UI callbacks, getLabel
});
```

**Why DI?**
- ✅ Core can be tested without full app
- ✅ Easy to mock time for testing schedules
- ✅ No global dependencies in core logic
- ✅ Panel can be developed independently

**Module Loading:**
```javascript
// recurringIntegration.js — initRecurringModules()
const version = options.AppMeta?.version || APP_VERSION;

const [recurringCore, settingsApplicator] = await Promise.all([
  import(`./recurringCore.js?v=${version}`),
  import(`./recurringSettingsApplicator.js?v=${version}`)
]);

// recurringCore.js then loads its sub-modules the same way
// (loadSubModules). The panel is imported later, on first open:
const { RecurringPanelManager, loadPanelSubModules /* ... */ } =
  await import(`./recurringPanel.js?v=${version}`);
```

#### Related Modules

**`modules/core/appState.js`** - State Management
- All recurring data stored in AppState
- Handles persistence to localStorage
- The recurring modules reach it through the injected `AppState` / `updateAppState` dependencies

**`modules/task/taskDOM.js`** - Task DOM and Button Handlers
- `setupRecurringButtonHandler()` handles clicks on the recurring button (🔁)
- Calls `handleRecurringTaskActivation()` / `handleRecurringTaskDeactivation()` through its injected dependencies

**`modules/task/taskCRUD.js`** - Task Create / Edit / Delete
- Deleting a recurring task by hand also deletes its template
- Renaming a task (`syncTemplateFromTask()`) or changing its priority also updates the template

**`modules/task/taskCycleReset.js`** - Cycle Reset
- Calls `removeRecurringTasksFromCycle()` to plan the removal, then applies the plan inside its own `AppState.update()`
- Its To-Do clear path records the template's `position` when a completed recurring task is cleared

**`modules/boot/moduleManifests.js`** / **`modules/boot/moduleLoader.js`** - Boot
- The manifest entry `recurringIntegration` declares the phase and dependencies
- The loader's dependency mappings route calls such as `handleRecurringTaskActivation` and `removeRecurringTasksFromCycle` to `deps.recurring.core`

**File Reference Summary:**
```
modules/recurring/
  ├── recurringCore.js                 - Coordinator, loads the logic sub-modules
  ├── recurringDateUtils.js            - Date helpers
  ├── recurringSettings.js             - Settings normalization
  ├── recurringCalculators.js          - Next-occurrence calculation and formatting
  ├── recurringMatcher.js              - Pattern matching
  ├── recurringWatcher.js              - Watch, catch-up, interval
  ├── recurringActivation.js           - On/off, template deletion, reset planning
  ├── recurringTemplate.js             - Template record, pause state, sync helpers
  ├── recurringSettingsApplicator.js   - Apply panel settings to tasks
  ├── recurringIntegration.js          - Wiring/setup
  ├── recurringBoot.js                 - Boot-time button, info link, open triggers
  └── recurringPanel*.js               - UI panel and its sub-modules (lazy)

modules/core/appState.js               - Data persistence
modules/task/taskDOM.js                - Recurring button handler
modules/task/taskCycleReset.js         - Cycle reset / To-Do clear
modules/boot/moduleManifests.js        - Boot registration
```

### Storage Schema

```javascript
// Where recurring data sits in the stored state (Schema 2.6, abridged)
{
  "appState": { "activeRoutineId": "<routineId>" },
  "data": {
    "routine": {
      "<routineId>": {
        "title": "Morning Routine",
        "tasks": [
          {
            "id": "task-bed",
            "text": "Make bed",
            "completed": false,
            "recurring": false
          },
          {
            "id": "task-med",
            "text": "Take medication",
            "completed": false,
            "recurring": true,
            "recurringSettings": {
              "frequency": "daily",
              "indefinitely": true,
              "time": { "hour": 9, "minute": 0, "meridiem": "AM" }
            }
          }
        ],
        "recurringTemplates": {
          "task-med": {
            "id": "task-med",
            "text": "Take medication",
            "recurring": true,
            "recurringSettings": {
              "frequency": "daily",
              "indefinitely": true,
              "time": { "hour": 9, "minute": 0, "meridiem": "AM" }
            },
            "occurrenceCount": 1,
            "lastTriggeredTimestamp": 1736931600000,
            "nextScheduledOccurrence": 1737019200000,
            "paused": false,
            "position": 1,
            "schemaVersion": 2
          }
        }
      }
    }
  }
}
```

Stored `recurringSettings` are the full normalized shape (every frequency block present, see *Frequency Options Reference*); the example shows only the fields in use. The template also carries `dueDate`, `dueTime`, `priority`, `remindersEnabled` and `autoClear` (see *The Two-Part System*). The complete schema is in [SCHEMA_2_6.md](SCHEMA_2_6.md).

### Key Functions

Below are the core functions with their file locations. The code blocks are simplified; read the named file for the real implementation.

#### Toggle Recurring On
**Location:** `modules/recurring/recurringActivation.js`
**Functions:** `handleRecurringTaskActivation(task, taskContext, button)` (the 🔁 button) and `applyRecurringToTask(taskId, newSettings)` (the Quick Actions "Apply"); both write state through `activateTaskRecurringState(cycle, taskId, normalizedSettings, calculateNextOccurrenceFn)`
```javascript
async function handleRecurringTaskActivation(task, taskContext, button = null) {
  // 1. Pick the settings: the task's previous recurringSettings if it has any,
  //    otherwise settings.defaultRecurringSettings (daily, indefinite), normalized
  const normalizedSettings = normalizeRecurringSettings(/* ... */);

  // 2. One AppState.update(): mark the task and build the template
  await updateAppState(draft => {
    const routine = getRoutine(draft, getActiveRoutineId(draft));
    activateTaskRecurringState(routine, taskId, normalizedSettings, calculateNextOccurrence);
    //   task.recurring = true; task.recurringSettings = normalizedSettings
    //   task.autoClear = clear in every mode
    //   routine.recurringTemplates[taskId] = buildRecurringTemplate({
    //     id, text, position, recurringSettings, priority, dueDate, dueTime,
    //     remindersEnabled,
    //     nextScheduledOccurrence: calculateNextOccurrence(normalizedSettings, Date.now())
    //   })
  }, true);

  // 3. Sync the task's DOM (recurring class, settings attribute)

  // 4. Show quick actions notification
  showNotificationWithTip(notifications.createRecurringNotificationWithTip(/* ... */), "recurring", 10000, /* ... */);

  // 5. Restart the watcher at the active interval; refresh menu button + info link
  restartRecurringWatcher();
}
```

The task stays in the list when recurring is switched on, so nothing has to "appear": the template's first `nextScheduledOccurrence` is simply the next scheduled time after now. (Earlier versions set it to `0` for newly-enabled tasks; the code no longer does.)

#### Toggle Recurring Off
**Location:** `modules/recurring/recurringActivation.js`
**Functions:** `handleRecurringTaskDeactivation(task, taskContext, assignedTaskId)`, which writes state through `deactivateTaskRecurringState(cycle, taskId)`. `deleteRecurringTemplate(taskId)` removes only the template (used by the panel's Remove).
```javascript
async function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId) {
  await updateAppState(draft => {
    const routine = getRoutine(draft, activeRoutineId);

    // 1. Mark task as non-recurring; reset its autoClear map to the normal defaults
    // Note: recurringSettings are preserved for if user toggles back on
    // 2. Remove template
    deactivateTaskRecurringState(routine, assignedTaskId);

    // 3. Keep task in main array
    // (Task stays visible, just not recurring anymore)
  }, true);

  // 4. Update the task's DOM, then notify and refresh menu button + info link
  showNotification("Recurring turned off for this task.");
}
```

#### Frequency Options Reference

miniCycle supports six frequency types, each with customizable options:

**1. Hourly** - Every hour at a set minute (when no minute is chosen, the normalizer anchors to the minute at which the task was set up)
```javascript
recurringSettings: {
  frequency: "hourly",
  hourly: {
    useSpecificMinute: true,
    minute: 30  // Trigger at :30 of every hour
  }
}
```

**2. Daily** - Every day, with optional specific time
```javascript
recurringSettings: {
  frequency: "daily",
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}
```

**3. Weekly** - Specific days of the week
```javascript
recurringSettings: {
  frequency: "weekly",
  weekly: {
    days: ["Mon", "Wed", "Fri"]  // Array of day abbreviations
  },
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}
```

**4. Biweekly** - **Two-week pattern with different days per week** (v1.348+)
```javascript
recurringSettings: {
  frequency: "biweekly",
  biweekly: {
    week1: ["Mon", "Wed"],        // Days for Week 1 (even weeks)
    week2: ["Tue", "Thu"],        // Days for Week 2 (odd weeks)
    referenceDate: "2025-01-06T14:00:00.000Z"  // Week 1 start: set when the task becomes biweekly, kept across edits
  },
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}
```
**New in v1.348:** Biweekly now supports **separate day selections for each week** in the two-week cycle:
- **Week 1 (even weeks 0, 2, 4, ...):** Select which days the task appears
- **Week 2 (odd weeks 1, 3, 5, ...):** Select different days for alternating weeks
- **DST-Safe Calculation:** Week determination uses calendar date arithmetic (not raw milliseconds) to maintain accuracy across Daylight Saving Time transitions
- **Example Use Cases:**
  - Alternating workout schedule: Week 1 Mon/Wed/Fri, Week 2 Tue/Thu
  - Biweekly meetings: Week 1 Tuesday, Week 2 Thursday
  - Rotating chores: Different days each week in a 2-week cycle

**5. Monthly** - Specific day(s) of the month or week-of-month patterns (v1.349+)
```javascript
// OPTION A: Specific days of month (with optional last day)
recurringSettings: {
  frequency: "monthly",
  monthly: {
    useSpecificDays: true,
    days: [1, 15],    // 1st and 15th of each month
    lastDay: true     // Also include last day of month (NEW v1.349+)
  },
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}

// OPTION B: Week-of-month pattern (NEW v1.349+)
recurringSettings: {
  frequency: "monthly",
  monthly: {
    useWeekOfMonth: true,
    weekOfMonth: {
      ordinal: "2",    // "1", "2", "3", "4", or "last"
      day: "Tue"       // "Sun", "Mon", "Tue", ..., "Sat"
    }
  },
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}
```
**New in v1.349:** Monthly recurring now supports three patterns:

1. **Specific Days Pattern** - Traditional day numbers (1-31)
   - Select multiple days: `[1, 15, 30]`
   - Invalid days (e.g., 31 in April) are automatically skipped

2. **Last Day Option** - Include last day of every month (NEW)
   - Automatically adapts to month length
   - Works correctly for February (28/29 days), 30-day months, and 31-day months
   - Can be combined with specific days
   - Example: `days: [1, 15], lastDay: true` = 1st, 15th, and last day

3. **Week-of-Month Pattern** - Nth occurrence of a weekday (NEW)
   - **1st through 4th:** "1st Monday", "2nd Tuesday", "3rd Wednesday", "4th Thursday"
   - **Last:** "Last Friday" (finds last occurrence regardless of week number)
   - **Example Use Cases:**
     - "2nd Tuesday of month" for recurring meetings
     - "Last Friday of month" for monthly reports
     - "1st Monday of month" for monthly reviews
   - Note: Only 1st–4th and Last can be chosen, so the pattern exists in every month; a stored ordinal outside that list is normalized to "1"

**6. Yearly** - Specific months and days
```javascript
recurringSettings: {
  frequency: "yearly",
  yearly: {
    months: [1, 6, 12],           // January, June, December
    useSpecificDays: true,
    daysByMonth: {
      1: [1, 15],                 // Jan 1st and 15th
      6: [1],                     // Jun 1st
      12: [25]                    // Dec 25th
    },
    applyDaysToAll: false         // Different days per month (true: one list under daysByMonth.all)
  },
  time: { hour: 9, minute: 0, meridiem: "AM", military: false }
}
```

**Specific dates.** Besides the six frequencies, `recurringSettings.specificDates = { enabled: true, dates: ["2025-03-01", ...] }` makes the task recur on listed dates only. When enabled it overrides the frequency in both the calculator and the matcher, and still honours `time` if one is set. The list is capped at `LIMITS.MAX_SPECIFIC_DATES`.

**Empty selections.** `normalizeRecurringSettings()` fills an empty selection from the day the settings are saved: weekly with no days → today's weekday; biweekly with no days → today's weekday in Week 1 only; monthly with no pattern → today's day of the month; yearly with no months → today's month and day. An unknown `frequency` is coerced to `"daily"`.

#### Duration Options (NEW v1.349+)

All frequency types support three duration modes to control how long a task recurs:

**1. Recur Indefinitely** (default)
```javascript
recurringSettings: {
  frequency: "daily",
  indefinitely: true,    // Task continues recurring forever
  count: null,
  untilDate: null
}
```
- Task continues recurring without any end date
- Default setting when first enabling recurring
- Most common for ongoing routines and habits

**2. Specific Number of Times**
```javascript
recurringSettings: {
  frequency: "weekly",
  weekly: { days: ["Mon", "Wed", "Fri"] },
  indefinitely: false,
  count: 12,            // Stop after 12 occurrences
  untilDate: null
}
```
- Task stops recurring after specified number of occurrences
- Useful for limited-duration projects or trial periods
- Example: "Take course for 8 weeks" → count: 8 for weekly task

**3. Until Specific Date** (NEW v1.349+)
```javascript
recurringSettings: {
  frequency: "daily",
  indefinitely: false,
  count: null,
  untilDate: "2025-12-31"    // Stop recurring after this date (YYYY-MM-DD)
}
```
- Task stops recurring after the specified end date
- Date validation checks occur at end of day (23:59:59)
- Task will still trigger ON the end date itself
- **Example Use Cases:**
  - Temporary medication: Daily until treatment ends
  - Seasonal tasks: "Water lawn" until October 31
  - Project deadlines: "Daily standup" until project completion date
  - Countdown routines: "Exam prep" until exam date
- **Works with all frequency types:** hourly, daily, weekly, biweekly, monthly, yearly

**Duration Priority:**
- If `indefinitely: true` → the count is ignored (`isCountExhausted()` in `recurringWatcher.js` requires `indefinitely === false`)
- If `indefinitely: false` and `count` is set → the template's `occurrenceCount` goes up by one per spawn; when it reaches `count` the template's `nextScheduledOccurrence` becomes `null`, a "completed all N scheduled occurrences" notification is shown, and the task stops recurring
- If `untilDate` is set → `calculateNextOccurrence()` returns `null` for any occurrence after the end of that day and the matcher refuses to recur past it. The code checks `untilDate` whenever it is present, whatever `indefinitely` says
- The panel offers the three modes as alternatives

#### Calculate Next Occurrence
**Location:** `modules/recurring/recurringCalculators.js` (date helpers in `modules/recurring/recurringDateUtils.js`)
**Functions:**
- `calculateNextOccurrence(settings, fromTime)` - Main entry: normalizes, dispatches, then enforces the end date
- `calculateNextHourly(hourlySettings, from)` - Hourly logic, stepping in real hours (DST-safe)
- `calculateNextDaily(timeSettings, from)` - Daily logic (no time set → start of tomorrow)
- `calculateNextWeekly(weeklySettings, timeSettings, from)` - Weekly logic
- `calculateNextBiweekly(biweeklySettings, timeSettings, from)` - Biweekly logic with DST-safe calculation
- `calculateNextMonthly(monthlySettings, timeSettings, from)` - Monthly logic
- `calculateNextYearly(yearlySettings, timeSettings, from)` - Yearly logic
- `calculateNextSpecificDate(dates, from, timeSettings)` - Specific-dates logic
- `calculateNextOccurrences(settings, count, fromTime)` - The next several occurrences
- `formatNextOccurrence(nextOccurrence)` - Display formatting
- `getDaysBetween(startDate, endDate)` - DST-safe day calculation helper (`recurringDateUtils.js`)
```javascript
function calculateNextOccurrence(settings, fromTime = Date.now()) {
  settings = normalizeRecurringSettings(settings);
  const from = new Date(fromTime);

  let next;
  if (settings.specificDates?.enabled && settings.specificDates.dates.length > 0) {
    // Specific dates override the frequency
    next = calculateNextSpecificDate(settings.specificDates.dates, from, settings.time);
  } else {
    switch (settings.frequency) {
      case "hourly":   next = calculateNextHourly(settings.hourly, from); break;
      case "daily":    next = calculateNextDaily(settings.time, from); break;
      case "weekly":   next = calculateNextWeekly(settings.weekly, settings.time, from); break;
      case "biweekly": next = calculateNextBiweekly(settings.biweekly, settings.time, from); break;
      case "monthly":  next = calculateNextMonthly(settings.monthly, settings.time, from); break;
      case "yearly":   next = calculateNextYearly(settings.yearly, settings.time, from); break;
    }
  }
  if (next === null) return null;

  // End date: never schedule past settings.untilDate (inclusive, end of day)
  if (settings.untilDate && next > endOfDay(settings.untilDate)) return null;

  return next; // epoch ms
}

function formatNextOccurrence(nextOccurrence) {
  // Every string comes from the label registry (recurring.next* labels)
  if (!nextOccurrence) return "No upcoming occurrences";

  const msUntil = nextOccurrence - Date.now();
  if (msUntil < 0) return "Overdue";
  if (msUntil < 60000) return "Appears in less than 1 minute";

  // Within 1 hour
  if (msUntil < 3600000) return `Appears in ${minutes} minute(s)`;

  // Within 24 hours
  if (msUntil < 86400000) return `Appears in ${hours} hour(s)`;

  // Beyond 24 hours - show specific date/time in the device's 12/24-hour clock
  const timeStr = next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (/* next falls on tomorrow's date */) {
    return `Next: Tomorrow at ${timeStr}`;
  } else if (msUntil < 604800000) {
    return `Next: ${weekdayName} at ${timeStr}`;
  } else {
    return `Next: ${dateStr} at ${timeStr}`; // e.g. "Wed, Jan 15, 2025"
  }
}
```

#### Check if Task Should Recreate (Hybrid Approach)
**Location:** `modules/recurring/recurringMatcher.js`
**Functions:**
- `shouldRecreateRecurringTask(template, taskList, now)` - Validation logic used by the 15-second watch
- `shouldTaskRecurNow(settings, now)` - Pattern matching (one matcher per frequency)

The fast path (`now < template.nextScheduledOccurrence`) is checked by the caller, `recreateDueTasks()` in `recurringWatcher.js`, before this function runs.
```javascript
function shouldRecreateRecurringTask(template, taskList, now) {
  if (!template.recurring || !template.recurringSettings) return false;

  // 1. Already exists? Skip
  if (taskList.some(t => t.id === template.id)) return false;

  // 2. Suppressed until a later time?
  if (template.suppressUntil && new Date(template.suppressUntil) > now) return false;

  // 3. Was it just triggered? (prevent duplicates)
  //    Compared as real minutes since the epoch, not clock readings (DST-safe)
  if (template.lastTriggeredTimestamp &&
      sameRealMinute(template.lastTriggeredTimestamp, now)) return false;

  // 4. Slow path: Validate with pattern matching
  return shouldTaskRecurNow(template.recurringSettings, now);
}

function shouldTaskRecurNow(settings, now) {
  settings = normalizeRecurringSettings(settings);

  // Past the end date (end of that day)? Never recur
  if (settings.untilDate && now > endOfDay(settings.untilDate)) return false;

  // Specific dates override the frequency
  if (settings.specificDates?.enabled) { /* today must be a listed date */ }

  const { frequency, time } = settings;
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" }); // "Mon"

  // Daily: at the scheduled minute, or any time when no time is set
  if (frequency === "daily") {
    return time ? isAtScheduledTime(time, now) : true;
  }

  // Weekly on specific days (short names: "Mon", "Tue", ...)
  if (frequency === "weekly") {
    if (!settings.weekly.days.includes(weekday)) return false;
    return time ? isAtScheduledTime(time, now) : true;
  }

  // Biweekly - two-week pattern (v1.348+ with DST-safe calculation)
  if (frequency === "biweekly") {
    const referenceDate = new Date(settings.biweekly.referenceDate);

    // DST-safe day calculation using calendar dates
    const daysSinceReference = getDaysBetween(referenceDate, now);
    const weeksSinceReference = Math.floor(daysSinceReference / 7);
    const isWeek1 = weeksSinceReference % 2 === 0;

    // Check appropriate week's days
    const currentWeekDays = isWeek1 ? settings.biweekly.week1 : settings.biweekly.week2;
    if (currentWeekDays.length === 0) return false;
    if (!currentWeekDays.includes(weekday)) return false;
    return time ? isAtScheduledTime(time, now) : true;
  }

  // Hourly: the chosen minute (minute 0 when none is stored)
  // ... monthly, yearly
}

// DST-safe helper function (recurringDateUtils.js)
function getDaysBetween(startDate, endDate) {
  // Normalize to midnight UTC to eliminate DST effects
  const start = new Date(Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ));
  const end = new Date(Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  ));

  const millisecondsDiff = end - start;
  return Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
}
```

`isAtScheduledTime()` places the time on today's date with the same helper the calculator uses (`applyTimeToDate()`), so the matcher and the scheduler agree on a day when the clocks change.

#### Catch Up Missed Tasks
**Location:** `modules/recurring/recurringWatcher.js`
**Function:** `catchUpMissedRecurringTasks()`
**Triggers:** at startup (`setupRecurringWatcher()`, when the active routine has templates), when a routine is loaded (`routineLoader.js`), when the browser tab becomes visible again (`visibilitychange` event), and from a watch tick that detects it overslept
```javascript
async function catchUpMissedRecurringTasks() {
  if (!Deps.isEnabled()) return { added: 0, updated: 0 };
  await Deps.appInit?.waitForCore();

  const state = Deps.AppState.get();
  const activeRoutineId = getActiveRoutineId(state);
  const routine = getRoutine(state, activeRoutineId);
  const templates = routine?.recurringTemplates || {};
  if (!Object.keys(templates).length) return { added: 0, updated: 0 };

  const now = new Date(Deps.now());

  // Shared engine, with NO pattern re-validation: a template whose
  // nextScheduledOccurrence has passed is trusted as missed.
  // One task per template, however many occurrences were missed.
  const stats = await recreateDueTasks(activeRoutineId, templates, routine.tasks, now);

  if (stats.added > 0) {
    Deps.showNotification(`Added ${stats.added} missed recurring task(s)`, 'info');
  }
  return stats; // { added, updated, blocked }
}
```

`recreateDueTasks()` skips a template that is already in the list, paused, finished (`nextScheduledOccurrence == null`), count-exhausted, or not yet due. Each template is evaluated in its own `try`, so one template with bad data cannot stop the others.

#### Watch Recurring Tasks (15-second Polling)
**Location:** `modules/recurring/recurringWatcher.js`
**Function:** `watchRecurringTasks()`
**Trigger:** Runs every `INTERVALS.RECURRING_WATCHER` (15 seconds) via the injected `setInterval`; the interval is created by `switchInterval()` in the same file, first called from `setupRecurringWatcher()`. It also runs on `visibilitychange`, shortly after a recurring task is checked off (`taskCompletion.js`, through its optional `watchRecurringTasks` dependency), and from `restartRecurringWatcher()` when a template is created or changed.
```javascript
// Simplified version of the watch function
export async function watchRecurringTasks() {
  if (!Deps.isEnabled()) return;

  // Wait for core systems
  await Deps.appInit?.waitForCore();

  // Get current state
  const state = Deps.AppState.get();
  const activeRoutineId = getActiveRoutineId(state);
  const routine = getRoutine(state, activeRoutineId);
  const templates = routine.recurringTemplates || {};
  const taskList = routine.tasks || [];

  // 15s while templates exist, 2h idle when there are none
  switchInterval(Object.keys(templates).length > 0);

  const now = new Date(Deps.now());

  // Overslept (device sleep, frozen tab)? Let catch-up handle this tick
  if (overslept) return catchUpMissedRecurringTasks();

  // Shared engine, plus the slow-path pattern check for each due template
  await recreateDueTasks(activeRoutineId, templates, taskList, now,
    (template) => Deps.shouldRecreateRecurringTask(template, taskList, now));
}

async function recreateDueTasks(activeRoutineId, templates, taskList, now, extraEligibility) {
  // ...select the due templates, build instances, apply the task limit...

  // Commit as a SYSTEM mutation: saved immediately, not added to undo history
  await Deps.updateAppState(draft => {
    const routine = getRoutine(draft, activeRoutineId);
    // insert each new task at its template's position (append when unknown)
    // replace each spawned template with its advanced copy
  }, true, { system: true });
}
```

#### Cycle Reset (Delete Recurring Tasks)
**Location:** `modules/recurring/recurringActivation.js`
**Function:** `removeRecurringTasksFromCycle(taskElements, cycleData)`
**Called by:** `resetTasksData()` in `modules/task/taskCycleReset.js` when the cycle resets

The function only *plans* the removal. It removes the recurring task elements from the DOM and returns `{ removedIds, keptIds, templateUpdates }`; it does not touch state. The caller applies the plan inside its own `AppState.update()`.
```javascript
// recurringActivation.js — plan
function removeRecurringTasksFromCycle(taskElements, cycleData) {
  const plan = { removedIds: [], keptIds: [], templateUpdates: {} };

  taskElements.forEach(taskEl => {
    if (!taskEl.classList.contains('recurring')) return;
    const taskId = taskEl.dataset.taskId;
    const task = cycleData.tasks.find(t => t.id === taskId);

    // Pinned (set NOT to clear): keep it, just uncheck it
    if (!getAutoClear(task, cycleData, DEFAULT_RECURRING_DELETE_SETTINGS)) {
      plan.keptIds.push(taskId);
      return;
    }

    taskEl.remove();
    plan.removedIds.push(taskId);

    // ✅ (v1.338+): Recalculate nextScheduledOccurrence from the current time
    if (cycleData.recurringTemplates?.[taskId]) {
      plan.templateUpdates[taskId] = {
        nextScheduledOccurrence: calculateNextOccurrence(template.recurringSettings, Date.now()),
        lastTriggeredTimestamp: null,             // Reset since cycle completed
        position: /* where the task sat in the list */
      };
    }
  });

  return plan;
}

// taskCycleReset.js — apply, inside AppState.update()
routine.tasks = routine.tasks.filter(t => !removedIds.has(t.id) /* and not cleared */);
keptIds.forEach(id => { /* task.completed = false */ });
Object.entries(templateUpdates).forEach(([id, upd]) => {
  const template = routine.recurringTemplates[id];
  template.nextScheduledOccurrence = upd.nextScheduledOccurrence;
  template.lastTriggeredTimestamp = upd.lastTriggeredTimestamp;
  template.position = upd.position;
  template.dueDate = null;   // the date belonged to the occurrence just cleared
  template.dueTime = null;
});
// Non-recurring tasks: completed = false, due date cleared

// Templates still exist in recurringTemplates
// They will be recreated by watchRecurringTasks() when due
```

---

## Comparison with Other Apps

### Traditional Task Apps (Todoist, TickTick, Things)

**How they handle recurring:**

```
User creates: "Take medication" (daily at 9am)

→ Task appears in today's list
→ User completes task
→ Task is duplicated for tomorrow
→ New task appears with same settings
→ Old task moves to "completed" history

Result: Growing list of completed instances
```

**Pros:**
- ✅ Can see history of completions
- ✅ Can complete task early or late
- ✅ Task always visible

**Cons:**
- ❌ Task list can become cluttered
- ❌ "Completed" list grows indefinitely
- ❌ No concept of a "cycle" - just individual tasks

### miniCycle Approach

**How miniCycle handles recurring:**

```
User creates: "Take medication" (daily at 9am, recurring)

→ Task appears when scheduled (9am)
→ User completes all tasks → cycle resets
→ Task is deleted from list
→ Template remains in storage
→ Task recreates at 9am next day

Result: Clean task list, predictable workflow
```

**Pros:**
- ✅ Clean task list (no clutter)
- ✅ Cycle-based progress (not task-based)
- ✅ Tasks appear exactly when needed
- ✅ Perfect for repeatable workflows
- ✅ Only one catch-up task per template (no "makeup work" guilt)
- ✅ Encourages forward progress instead of dwelling on the past

**Cons (or Trade-offs):**
- ❌ Can't see completion history easily
- ❌ Task "disappears" until next occurrence
- ❌ Different mental model (learning curve)
- ❌ Not suitable for project-based work where every instance matters

### Side-by-Side Example

**Scenario:** Morning routine with medication at 9am

#### Todoist Approach:
```
Monday 8:00am:
☐ Make bed
☐ Exercise  
☐ Take medication (due 9am)
☐ Review calendar

Complete all → All move to "Completed"

Tuesday 8:00am:
☐ Make bed (new instance)
☐ Exercise (new instance)
☐ Take medication (due 9am) (new instance)
☐ Review calendar (new instance)

History tab shows:
✓ Make bed (Mon)
✓ Exercise (Mon)
✓ Take medication (Mon)
✓ Review calendar (Mon)
```

#### miniCycle Approach:
```
Monday 8:00am:
☐ Make bed
☐ Exercise
☐ Review calendar
(medication will appear at 9am)

Monday 9:00am:
☐ Make bed
☐ Exercise
☐ Take medication ← Appeared!
☐ Review calendar

Complete cycle → All reset:
☐ Make bed (same task, unchecked)
☐ Exercise (same task, unchecked)
☐ Review calendar (same task, unchecked)
(medication deleted, will reappear Tuesday 9am)

Tuesday 8:00am:
☐ Make bed
☐ Exercise
☐ Review calendar
(Same tasks, not duplicates)
```

---

## Who Should Use Recurring Tasks

### ✅ Perfect For:

#### 1. **Scheduled Medications**
**Pattern:** Take medication at specific times, not every cycle

**Example:**
```
Morning Routine:
☐ Wake up
☐ Shower
☐ Take medication (9am, recurring) ← Only once per day
☐ Get dressed
```

**Why recurring?** You don't want "take medication" appearing every time you complete the routine. It should only appear once daily at 9am.

#### 2. **Time-Based Work Tasks**
**Pattern:** Tasks that happen at scheduled times during work

**Example:**
```
Daily Work Cycle:
☐ Check email
☐ Review tasks
☐ Team standup (10am, recurring) ← Only once per day
☐ Focus work
☐ End-of-day review (5pm, recurring) ← Only once per day
```

**Why recurring?** These tasks are scheduled events, not general workflow steps.

#### 3. **Weekly/Monthly Reviews**
**Pattern:** Tasks that happen on specific days

**Example:**
```
Work Routine:
☐ Process inbox
☐ Update tasks
☐ Weekly review (Friday, recurring) ← Only Fridays
☐ Check calendar
```

**Why recurring?** You only want the weekly review appearing on Fridays, not every day.

#### 4. **Compliance Checks on Schedule**
**Pattern:** Inspections or checks that happen at intervals

**Example:**
```
Equipment Checklist:
☐ Visual inspection
☐ Check readings
☐ Monthly calibration (1st of month, recurring)
☐ Log results
```

**Why recurring?** Calibration only happens monthly, not every inspection.

### ❌ Not Ideal For:

#### 1. **Tasks That Repeat Every Cycle**
**Wrong approach:**
```
✗ Make bed (recurring daily)
✗ Exercise (recurring daily)
```

**Right approach:**
```
✓ Make bed (regular task, resets)
✓ Exercise (regular task, resets)
```

**Why?** If a task happens every time you complete the cycle, just make it a regular task. It will reset automatically.

#### 2. **One-Time Tasks**
**Wrong approach:**
```
✗ Call dentist (recurring)
```

**Right approach:**
```
✓ Call dentist (regular task with reminder)
```

**Why?** One-time tasks don't need recurring. Use reminders instead.

#### 3. **Tasks Needing Flexibility**
**Wrong approach:**
```
✗ Exercise 3x per week (recurring Mon/Wed/Fri)
```

**Problem:** If you miss Monday, you can't "move" it to Tuesday easily.

**Right approach:**
```
✓ Exercise (regular task, check off 3 times per week)
```

**Why?** Flexible tasks work better as regular tasks you can complete whenever.

---

## Alternatives & When to Use Them

### Option 1: Regular Tasks (Auto-Reset)

**How it works:**
- Task stays in your list always
- Unchecks when cycle completes
- No scheduling, just presence

**When to use:**
```
✓ Morning routine steps (every cycle)
✓ Inspection checklist items (every inspection)
✓ Closing procedure steps (every close)
✓ Any task that repeats every cycle
```

**Example:**
```
Morning Routine:
☐ Make bed ← Resets every cycle
☐ Exercise ← Resets every cycle
☐ Breakfast ← Resets every cycle
```

### Option 2: Reminders (Stay Visible + Notify)

**How it works:**
- Task stays in your list
- Notification fires at set time
- Task persists until you complete it

**When to use:**
```
✓ Important deadlines
✓ Time-sensitive tasks you might forget
✓ Tasks you want visible as a constant reminder
✓ One-time scheduled events
```

**Example:**
```
Today's Tasks:
☐ Submit report (reminder: 3pm)
☐ Call client (reminder: 2pm)
☐ Review document
```

**Difference from recurring:**
- **Recurring:** Task disappears and reappears on schedule
- **Reminders:** Task stays visible, just notifies you

### Option 3: Manual Cycle Mode

**How it works:**
- Tasks don't auto-reset
- You click "Complete" button manually
- More control over when cycle resets

**When to use:**
```
✓ Variable-length workflows
✓ Quality control (want to review before reset)
✓ Training checklists (complete when done, not time-based)
```

**Example:**
```
Onboarding Checklist:
☐ Setup account
☐ Complete training modules
☐ Shadow team member
☐ First solo task

[Complete] ← Click when truly done
```

### Decision Tree

```
Does this task happen every cycle?
  └─ YES → Use regular task (auto-reset)
  └─ NO → Continue...

Does it happen on a specific schedule?
  └─ YES → Use recurring task
  └─ NO → Continue...

Do you just need a reminder?
  └─ YES → Use reminders (task stays visible)
  └─ NO → Use regular task with manual mode
```

---

## Troubleshooting & FAQs

### Q: "My recurring task isn't appearing!"

**Checklist:**

1. **Is it actually set to recurring?**
   - Open the Recurring panel from the main menu
   - Check if the task appears in the list
   - If not there, the task isn't set to recur

2. **Is it paused, pinned, or finished?**
   - A paused task shows "Paused" in the panel and does not recur until you resume it
   - A recurring task pinned to the list shows "Paused · pinned"; it never leaves the list, so there is nothing to reappear
   - A task that has used up its number of times, or passed its end date, shows "No upcoming occurrences"

3. **Check the next occurrence time:**
   - Open the Recurring panel
   - Look for "Next: [time]" under the task
   - This shows exactly when it will appear
   - Example: "Next: Tomorrow at 9:00 AM" means it's scheduled for tomorrow

4. **Has enough time passed?**
   - Watch function checks every 15 seconds
   - Wait up to 15 seconds after scheduled time
   - Example: 9:00am task may appear between 9:00:00 and 9:00:15

5. **Did the task already appear?**
   - Check if it's already in your task list
   - Recurring tasks won't duplicate

6. **Is the schedule correct?**
   - Open Recurring Panel
   - Click task → "Change Settings"
   - Verify frequency and time
   - Check "Current Settings" summary

7. **Try the catch-up trigger:**
   - Switch to another tab or minimize the window
   - Return to miniCycle
   - The catch-up function will check for missed tasks
   - This forces an immediate check instead of waiting for the 15-second interval

8. **Did you reset the cycle at the scheduled time?**
   - A reset schedules each removed task for its next occurrence *after* the moment of the reset
   - If a daily 9:00am task is in the list and you complete the cycle at 9:00am or later, its next occurrence is 9:00am tomorrow
   - Separately, the watcher never recreates a task twice in the same minute

9. **Is the list full?**
   - A routine holds at most `LIMITS.TASKS_PER_CYCLE` tasks; a recurring task that would exceed it is held back (with a warning) and appears once there is room

10. **Is this the open routine?**
   - Only the routine you have open is checked. A missed task in another routine is added when you open that routine

11. **After cycle reset (v1.338+):**
   - The schedule is automatically recalculated from the current time
   - This ensures tasks can appear again based on the schedule
   - No manual intervention needed

### Q: "I can't see my recurring tasks after cycle reset!"

**This is expected behavior!**

Recurring tasks are **deleted on cycle reset** and reappear based on their schedule.

**To see them:**
- Open menu → "Recurring"
- This shows all scheduled tasks, even when not visible

**To check when they'll reappear:**
- Look at the "Current Settings" in Recurring Panel
- Example: "Daily at 9:00 AM" means it will appear at 9am

### Q: "How do I change a recurring task's schedule?"

**Method 1: From the Quick Actions notification (right after turning recurring on):**
1. Click "Change Settings" in the notification
2. Pick a frequency and click "Apply"
3. Or click "More Options" for full panel

(Clicking the 🔁 button on a task that is already recurring turns recurring off; it does not reopen the settings.)

**Method 2: From Recurring Panel (anytime):**
1. Open menu → "Recurring"
2. Click the task you want to change
3. Click "Change Settings"
4. Adjust and click "Apply"

### Q: "Can I turn off recurring without deleting the task?"

**Yes!** Toggling recurring off keeps the task:

1. Click recurring button (🔁) in task options
2. Task is unmarked as recurring
3. Task **stays** in your list
4. Template is removed
5. Task now behaves like a regular task (resets on cycle)

**Settings are preserved** - if you toggle recurring back on, your old schedule returns.

### Q: "What if I want to complete a recurring task early?"

**Current behavior:** You can check it off like any task, but:
- It will still be deleted on cycle reset
- It will reappear at its scheduled time

**If you need flexibility:** Consider using reminders instead of recurring, so the task stays visible.

### Q: "Why does the recurring link under my task list disappear?"

**The "Recurring" button in the main menu is always shown.** The info link under the task list ("N tasks set to recurring") only shows when the open routine has recurring templates.

**The link disappears when:**
- You turn off recurring for all tasks
- You delete all recurring tasks (deleting a recurring task also deletes its template)
- No templates exist on the routine

**It reappears when:**
- You set any task to recur
- You import a routine with recurring tasks

### Q: "Can I see when a recurring task will appear next?"

**Yes!** The Recurring Panel shows the next occurrence time for every scheduled task.

**How to view:**
1. Open menu → "Recurring"
2. Look under each task for "Next: [time]"

**Format examples:**
- "Appears in 30 minutes" - less than 1 hour away
- "Appears in 3 hours" - within 24 hours
- "Next: Tomorrow at 9:00 AM" - specific date and time
- "Next: Wednesday at 2:30 PM" - for weekly tasks

**Technical details:** miniCycle calculates `nextScheduledOccurrence` when you set recurring settings, and updates it each time the task appears, each time a cycle reset removes the task, and when you resume a paused task. This uses a hybrid optimization approach for performance.

### Q: "What happens if I miss multiple days of a daily recurring task?"

**miniCycle creates ONE task, not multiple catch-up tasks.**

This is intentional and core to miniCycle's cycle-based philosophy.

**Example:**
```
You have "Take medication" set to daily at 9am.
Monday 9am: Task appeared ✅
Tuesday: You didn't open the app ❌
Wednesday: You didn't open the app ❌
Thursday 2pm: You open miniCycle

Result: ONE "Take medication" task appears
(Not three tasks for Monday/Tuesday/Wednesday)
```

**Why only one task?**

miniCycle is designed for **routines and habits**, not project tracking:

1. **You can't retroactively do past routines**
   - Can't do yesterday's morning routine
   - Can't do 3 days of workouts at once
   - Can't drink 3 days worth of coffee in one morning

2. **Focus on today, not dwelling on the past**
   - Habit formation research shows "just do it today" builds momentum
   - "Make up for 3 missed days" creates guilt and avoidance
   - miniCycle encourages **forward progress**

3. **Prevents cycle clutter**
   ```
   ❌ Project-based approach (Todoist/Asana):
   [ ] Take medication (Monday - overdue)
   [ ] Take medication (Tuesday - overdue)
   [ ] Take medication (Wednesday - overdue)
   User feels overwhelmed, gives up

   ✅ Cycle-based approach (miniCycle):
   [ ] Take medication (due now)
   User can take action immediately
   ```

**This is a feature, not a bug!**

miniCycle is built for **cycle-based routine management**, not **project-based task tracking**. If you need to track every instance of a recurring task (like individual work deliverables), use a project management tool like Todoist or Asana instead.

**When miniCycle is perfect:**
- ✅ Daily habits (exercise, meditation, reading)
- ✅ Routines (morning ritual, bedtime checklist)
- ✅ Regular maintenance (medication, watering plants)
- ✅ Cyclical workflows (weekly review, monthly budget)

**When to use a different app:**
- ❌ Project milestones that must all be completed
- ❌ Work queues where every instance matters
- ❌ Assignments where you need to catch up on ALL missed days

### Q: "What happens if I'm offline when a task should appear?"

**Good news:** Everything is local!

- No internet needed
- Tasks recreate as long as the app is open
- If app is closed or tab is inactive, miniCycle catches up when you return

**Catch-Up Function:**
When you return to miniCycle after being away, it automatically checks for any missed recurring tasks:

1. **Trigger:** Runs when the app starts, when a routine is opened, when the browser tab becomes visible again, and when the watcher notices the device was asleep
2. **Check:** Scans the open routine's templates for a next occurrence that has passed
3. **Add Once:** Each template creates ONE task (see "What happens if I miss multiple days" above)
4. **Update:** Calculates next occurrence for future

**Example:**
```
You have two daily tasks: "Medication" (9am) and "Vitamins" (10am).
You close the tab at 8am and return at 5pm.

When you return:
✓ "Medication" task appears (once)
✓ "Vitamins" task appears (once)
✓ Next occurrence set to 9am/10am tomorrow
```

**Note:** Each template creates exactly one task, even if you missed multiple days. This keeps your task list clean and actionable while helping you get back on track with your routine.

### Q: "Can recurring tasks have different settings per cycle?"

**No.** Templates are cycle-specific but consistent within a cycle.

**Example:**
```
Morning Routine cycle:
  ✓ Can have: Take medication (daily 9am)
  
Evening Routine cycle:
  ✓ Can have: Take medication (daily 9pm)
  
Same task text, different schedules in different cycles ✓
```

---

## Best Practices

### 1. **Be Specific with Task Names**

**❌ Vague:**
```
☐ Medication (recurring)
```

**✅ Specific:**
```
☐ Take blood pressure medication (recurring 9am)
```

**Why?** When the task reappears, you know exactly what to do without checking the recurring panel.

### 2. **Use Time-Based Recurring Sparingly**

**Too many time-based tasks:**
```
☐ Medication (9am)
☐ Check email (10am)
☐ Lunch (12pm)
☐ Standup (2pm)
☐ Review (5pm)
```

**Problem:** Your task list is constantly changing. Hard to see your workflow.

**Better approach:**
```
☐ Morning prep
☐ Medication (9am, recurring)
☐ Work block
☐ Standup (2pm, recurring)
☐ End-of-day review
```

**Why?** Mix of stable tasks (your workflow) with scheduled tasks (time-specific events).

### 3. **Group Related Recurring Tasks**

**❌ Scattered:**
```
General Tasks cycle:
☐ Do work
☐ Medication (9am, recurring)
☐ More work
☐ Vitamins (8am, recurring)
```

**✅ Grouped:**
```
Morning Routine cycle:
☐ Wake up
☐ Vitamins (8am, recurring)
☐ Medication (9am, recurring)
☐ Get ready

Work Routine cycle:
☐ Check email
☐ Focus work
```

**Why?** Easier to manage, clearer workflow.

### 4. **Document Complex Schedules**

**For advanced recurring patterns:**
```
☐ Monthly report (recurring)
```

**Add details in task name or notes:**
```
☐ Monthly report (1st business day, recurring)
```

**Or use the Recurring Panel to verify:**
- Frequency: Monthly
- Days: [1]
- Time: 9:00 AM

---

## Summary

### Key Takeaways

1. **miniCycle is cycle-centric** - focus on completing workflows, not individual tasks

2. **Recurring tasks are scheduled** - they appear when it's time to do them, not every cycle

3. **Tasks delete on reset** - this keeps your list clean; templates ensure they come back

4. **Use the right pattern:**
   - **Every cycle** → Regular task (resets)
   - **On schedule** → Recurring task (deletes/recreates)
   - **Need reminder** → Reminders (stays visible)

5. **The Recurring panel is your control center** - see and edit scheduled tasks even when not visible

6. **Watch function checks every 15 seconds** (`INTERVALS.RECURRING_WATCHER`) - tasks appear automatically at scheduled times

### Who This Is For

✅ **You'll love recurring tasks if:**
- You have workflows with scheduled components
- You want clean, predictable task lists
- You like cycle-based progress tracking
- You do compliance work needing scheduled checks
- You have time-sensitive tasks mixed with routine work

❌ **You might prefer alternatives if:**
- You need flexible task scheduling
- You want to see completion history
- You need tasks visible at all times
- You're managing project-based work (not routine)
- You want traditional GTD-style task management

---

**Questions? Feedback? Found a bug?**

miniCycle is open source and actively developed. Your input helps improve the recurring system for everyone.

---

*miniCycle v1.338+ | sparkinCreations | 2025*

**Guide Changelog:**
- Nov 2026: Checked against the code for the docs audit — Technical Architecture rewritten for the split `modules/recurring/` modules, Schema 2.6 names, the menu button, watcher/catch-up behaviour and the Add Task flow corrected
- v1.3 (Nov 2025): Added comprehensive explanation of "one task only" catch-up behavior and cycle-based vs project-based philosophy
- v1.2 (Oct 2025): Added immediate appearance for newly-enabled recurring tasks, schedule recalculation on cycle reset
- v1.1 (Oct 2025): Added next occurrence display, catch-up function, two-state notifications, hybrid optimization
- v1.0 (Initial release): Core recurring functionality documentation
