# miniCycle Recurring Tasks: Complete User Guide

**Version 1.1 | For miniCycle Users & Developers**

_Updated October 2025 to include: Next occurrence display, catch-up function, two-state notifications, and hybrid optimization pattern._

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

**miniCycle is built around reusable checklists called "cycles."** When you complete all tasks in a cycle, the entire cycle resets—all your tasks become unchecked and ready to go again. This is perfect for:

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

#### 2. Recurring Template (in cycle storage)
```javascript
cycle.recurringTemplates["task-123"] = {
  id: "task-123",
  text: "Take medication",
  recurring: true,
  recurringSettings: { /* same as above */ },
  lastTriggeredTimestamp: "2025-01-15T09:00:00Z",
  nextScheduledOccurrence: 1737019200000  // Unix timestamp for next occurrence
}
```
**Purpose:** The "master copy" used to recreate the task on schedule. Includes optimization field for fast checking.

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
   
10. WATCH FUNCTION checks every 30 seconds
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
- Due dates
- Reminder settings

This allows the task to be **perfectly recreated** when its schedule says it's time.

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

// Template is created
currentCycle.recurringTemplates[taskId] = {
  id: taskId,
  text: "Take medication at 9am",
  recurring: true,
  recurringSettings: { /* same as above */ }
};
```

#### Step 2: Quick Actions Notification

**Immediately after toggling, you see a clean confirmation:**

```
┌─────────────────────────────────────────┐
│ "Your task text here"                💡 │
│                                          │
│ 🔁 Recurring set to daily (Indefinitely) │
│                                          │
│           [Change Settings]              │
└─────────────────────────────────────────┘

💡 Tip: Recurring tasks are removed on cycle
reset and reappear based on their schedule.
```

**Default state shows:**
- The task text you just made recurring
- Current frequency and pattern
- "Change Settings" button
- Tip toggle (💡) in top-right corner
- Auto-dismisses after 10 seconds (pauses on hover/interaction)

**Click "Change Settings" to expand quick options:**

```
┌─────────────────────────────────────────┐
│ "Your task text here"                💡 │
│                                          │
│ 🔁 Recurring set to daily (Indefinitely) │
│                                          │
│ Quick options:                           │
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

**Click "More Options" or open "Manage Recurring Tasks" from menu:**

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

// Template updated
currentCycle.recurringTemplates[taskId].recurringSettings = {
  /* same as above */
};

// Saved to localStorage
localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
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
// Recurring tasks deleted
tasks = tasks.filter(task => !task.recurring);

// Templates remain
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

**The Watch Function runs every 30 seconds (and on tab visibility):**

```javascript
// Simplified pseudocode with hybrid optimization
setInterval(() => {
  const now = Date.now();

  Object.values(recurringTemplates).forEach(template => {

    // Is this task currently in the list?
    const exists = tasks.find(t => t.id === template.id);
    if (exists) return; // Already there, skip

    // ========================================
    // HYBRID OPTIMIZATION PATTERN
    // ========================================

    // FAST PATH: Check pre-calculated timestamp
    if (template.nextScheduledOccurrence) {
      if (now < template.nextScheduledOccurrence) {
        return; // Not time yet, skip expensive pattern matching
      }
    }

    // SLOW PATH: Validate with pattern matching
    // (This ensures accuracy for complex patterns)
    if (shouldRecreateTask(template, now)) {

      // Recreate from template
      const newTask = {
        id: template.id,
        text: template.text,
        completed: false,
        recurring: true,
        recurringSettings: template.recurringSettings
      };

      tasks.push(newTask);
      renderTaskToDOM(newTask);

      // Update timestamps for next occurrence
      template.lastTriggeredTimestamp = now;
      template.nextScheduledOccurrence = calculateNextOccurrence(
        template.recurringSettings,
        now
      );

      saveToStorage();
    }
  });
}, 30000); // Check every 30 seconds

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
- **Slow Path:** Always validate with pattern matching to ensure accuracy (handles edge cases like DST, month boundaries)
- **Best of Both:** Fast checking for most cases, accurate validation when needed

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

**The "Manage Recurring Tasks" button appears in your menu when you have active recurring tasks.**

**Why?** Because recurring tasks get deleted after cycle reset, you need a way to:
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

**Next Occurrence Display:**
miniCycle shows you when each recurring task will appear next using human-readable formatting:
- "Appears in 30 minutes" (within 1 hour)
- "Appears in 3 hours" (within 24 hours)
- "Next: Tomorrow at 9:00 AM" (beyond 24 hours)
- "Next: Wednesday at 2:30 PM" (specific days and times)

This helps you understand your schedule at a glance without mental calculations.

---

## Technical Architecture

### Storage Schema

```javascript
// Full miniCycle data structure
{
  "data": {
    "cycles": {
      "Morning Routine": {
        "id": "morning-routine",
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
            "lastTriggeredTimestamp": "2025-01-15T09:00:00Z",
            "nextScheduledOccurrence": 1737019200000
          }
        }
      }
    }
  }
}
```

### Key Functions

#### Toggle Recurring On
```javascript
function handleRecurringTaskActivation(task, taskContext) {
  // 1. Mark task as recurring
  task.recurring = true;
  task.recurringSettings = getDefaultSettings(); // daily, indefinite

  // 2. Create template with next occurrence calculation
  const nextOccurrence = calculateNextOccurrence(task.recurringSettings);
  currentCycle.recurringTemplates[task.id] = {
    id: task.id,
    text: task.text,
    recurring: true,
    recurringSettings: structuredClone(task.recurringSettings),
    lastTriggeredTimestamp: null,
    nextScheduledOccurrence: nextOccurrence
  };

  // 3. Save to storage
  saveToLocalStorage();

  // 4. Show quick actions notification
  showQuickActionsNotification(task);

  // 5. Update UI
  updateRecurringPanelButtonVisibility();
}
```

#### Toggle Recurring Off
```javascript
function handleRecurringTaskDeactivation(task, taskId) {
  // 1. Mark task as non-recurring
  task.recurring = false;
  // Note: Settings are preserved for if user toggles back on
  
  // 2. Remove template
  delete currentCycle.recurringTemplates[taskId];
  
  // 3. Keep task in main array
  // (Task stays visible, just not recurring anymore)
  
  // 4. Save to storage
  saveToLocalStorage();
  
  // 5. Update UI
  updateRecurringPanelButtonVisibility();
  showNotification("Recurring turned off");
}
```

#### Calculate Next Occurrence
```javascript
function calculateNextOccurrence(settings, fromTime = Date.now()) {
  const { frequency, time } = settings;

  // Handle different frequencies
  switch (frequency) {
    case "hourly":
      return calculateNextHourlyOccurrence(settings, fromTime);

    case "daily":
      return calculateNextDailyOccurrence(settings, fromTime);

    case "weekly":
      return calculateNextWeeklyOccurrence(settings, fromTime);

    case "biweekly":
      return calculateNextBiweeklyOccurrence(settings, fromTime);

    case "monthly":
      return calculateNextMonthlyOccurrence(settings, fromTime);

    case "yearly":
      return calculateNextYearlyOccurrence(settings, fromTime);
  }

  return null; // Invalid frequency
}

function formatNextOccurrence(nextOccurrence) {
  if (!nextOccurrence) return null;

  const now = Date.now();
  const diff = nextOccurrence - now;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  // Within 1 hour
  if (minutes < 60) {
    return `Appears in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  // Within 24 hours
  if (hours < 24) {
    return `Appears in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  // Beyond 24 hours - show specific date/time
  const date = new Date(nextOccurrence);
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday",
                   "Thursday", "Friday", "Saturday"][date.getDay()];
  const timeStr = formatTime(date); // e.g., "9:00 AM"

  if (days === 1) {
    return `Next: Tomorrow at ${timeStr}`;
  } else if (days < 7) {
    return `Next: ${dayName} at ${timeStr}`;
  } else {
    return `Next: ${date.toLocaleDateString()} at ${timeStr}`;
  }
}
```

#### Check if Task Should Recreate (Hybrid Approach)
```javascript
function shouldRecreateRecurringTask(template, taskList, now) {
  // 1. Already exists? Skip
  if (taskList.find(t => t.id === template.id)) {
    return false;
  }

  // 2. Fast path: Check nextScheduledOccurrence
  if (template.nextScheduledOccurrence) {
    if (now < template.nextScheduledOccurrence) {
      return false; // Not time yet
    }
  }

  // 3. Was it just triggered? (prevent duplicates)
  if (template.lastTriggeredTimestamp) {
    const lastTriggered = new Date(template.lastTriggeredTimestamp);
    const sameMinute = isSameMinute(lastTriggered, now);
    if (sameMinute) return false;
  }

  // 4. Slow path: Validate with pattern matching
  return shouldTaskRecurNow(template.recurringSettings, now);
}

function shouldTaskRecurNow(settings, now) {
  const { frequency, time } = settings;

  // Daily at specific time
  if (frequency === "daily" && time) {
    return now.getHours() === time.hour &&
           now.getMinutes() === time.minute;
  }

  // Weekly on specific days
  if (frequency === "weekly" && settings.weekly?.days) {
    const dayNames = ["Sunday", "Monday", "Tuesday", ...];
    const today = dayNames[now.getDay()];
    return settings.weekly.days.includes(today);
  }

  // ... other frequencies
}
```

#### Catch Up Missed Tasks
```javascript
async function catchUpMissedRecurringTasks() {
  const state = getAppState();
  const currentCycle = state.cycles[state.appState.activeCycleId];
  if (!currentCycle?.recurringTemplates) return;

  const now = Date.now();
  const tasksToAdd = [];

  // Check each template for missed occurrences
  Object.values(currentCycle.recurringTemplates).forEach(template => {
    // Skip if already in task list
    if (currentCycle.tasks.find(t => t.id === template.id)) return;

    // Check if it should have appeared by now
    if (shouldTaskRecurNow(template.recurringSettings, now)) {
      tasksToAdd.push({
        id: template.id,
        text: template.text,
        completed: false,
        recurring: true,
        recurringSettings: template.recurringSettings
      });

      // Update template for next occurrence
      template.lastTriggeredTimestamp = now;
      template.nextScheduledOccurrence = calculateNextOccurrence(
        template.recurringSettings,
        now
      );
    }
  });

  // Add all missed tasks in batch
  if (tasksToAdd.length > 0) {
    updateAppState(draft => {
      const cycle = draft.cycles[draft.appState.activeCycleId];
      cycle.tasks.push(...tasksToAdd);
    });
  }
}
```

#### Cycle Reset (Delete Recurring Tasks)
```javascript
function completeMiniCycle() {
  const tasks = currentCycle.tasks;
  
  // Separate recurring from non-recurring
  const recurringTasks = tasks.filter(t => t.recurring);
  const nonRecurringTasks = tasks.filter(t => !t.recurring);
  
  // Reset non-recurring tasks
  nonRecurringTasks.forEach(task => {
    task.completed = false;
  });
  
  // Delete recurring tasks (templates remain)
  currentCycle.tasks = nonRecurringTasks;
  
  // Templates still exist in recurringTemplates
  // They will be recreated by watchRecurringTasks() when due
  
  saveToLocalStorage();
  renderTasks(currentCycle.tasks);
}
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

**Cons:**
- ❌ Can't see completion history easily
- ❌ Task "disappears" until next occurrence
- ❌ Different mental model (learning curve)

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
   - Open "Manage Recurring Tasks" from menu
   - Check if the task appears in the list
   - If not there, the task isn't set to recur

2. **Check the next occurrence time:**
   - Open "Manage Recurring Tasks"
   - Look for "Next: [time]" under the task
   - This shows exactly when it will appear
   - Example: "Next: Tomorrow at 9:00 AM" means it's scheduled for tomorrow

3. **Has enough time passed?**
   - Watch function checks every 30 seconds
   - Wait up to 30 seconds after scheduled time
   - Example: 9:00am task may appear between 9:00:00 and 9:00:30

4. **Did the task already appear?**
   - Check if it's already in your task list
   - Recurring tasks won't duplicate

5. **Is the schedule correct?**
   - Open Recurring Panel
   - Click task → "Change Settings"
   - Verify frequency and time
   - Check "Current Settings" summary

6. **Try the catch-up trigger:**
   - Switch to another tab or minimize the window
   - Return to miniCycle
   - The catch-up function will check for missed tasks
   - This forces an immediate check instead of waiting for the 30-second interval

7. **Was it triggered recently?**
   - Tasks won't appear twice in the same minute
   - If you complete cycle at 9:00am and task is scheduled for 9:00am, it may not reappear until 9:01am

### Q: "I can't see my recurring tasks after cycle reset!"

**This is expected behavior!**

Recurring tasks are **deleted on cycle reset** and reappear based on their schedule.

**To see them:**
- Open menu → "Manage Recurring Tasks"
- This shows all scheduled tasks, even when not visible

**To check when they'll reappear:**
- Look at the "Current Settings" in Recurring Panel
- Example: "Daily at 9:00 AM" means it will appear at 9am

### Q: "How do I change a recurring task's schedule?"

**Method 1: From the task (while visible):**
1. Click task options (three dots)
2. Click recurring button (🔁)
3. Adjust settings in Quick Actions
4. Or click "More Options" for full panel

**Method 2: From Recurring Panel (anytime):**
1. Open menu → "Manage Recurring Tasks"
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

### Q: "Why does the 'Manage Recurring Tasks' button disappear?"

**The button only shows when you have active recurring tasks.**

**It disappears when:**
- You turn off recurring for all tasks
- You delete all recurring tasks
- No templates exist in storage

**It reappears when:**
- You set any task to recur
- You import a cycle with recurring tasks

### Q: "Can I see when a recurring task will appear next?"

**Yes!** The Recurring Panel shows the next occurrence time for every scheduled task.

**How to view:**
1. Open menu → "Manage Recurring Tasks"
2. Look under each task for "Next: [time]"

**Format examples:**
- "Appears in 30 minutes" - less than 1 hour away
- "Appears in 3 hours" - within 24 hours
- "Next: Tomorrow at 9:00 AM" - specific date and time
- "Next: Wednesday at 2:30 PM" - for weekly tasks

**Technical details:** miniCycle calculates `nextScheduledOccurrence` when you set recurring settings, and updates it each time the task appears. This uses a hybrid optimization approach for performance.

### Q: "What happens if I'm offline when a task should appear?"

**Good news:** Everything is local!

- No internet needed
- Tasks recreate as long as the app is open
- If app is closed or tab is inactive, miniCycle catches up when you return

**Catch-Up Function:**
When you return to miniCycle after being away, it automatically checks for any missed recurring tasks:

1. **Trigger:** Runs when browser tab becomes visible again
2. **Check:** Scans all templates for missed occurrences
3. **Add Once:** Each missed task appears only once (not duplicated)
4. **Update:** Calculates next occurrence for future

**Example:**
```
You have "Take medication" set to appear at 9am and 2pm daily.
You close the tab at 8am and return at 5pm.

When you return:
✓ Both 9am and 2pm tasks are added (once each)
✓ Next occurrence set to 9am tomorrow
```

**Note:** Tasks are only added once even if they should have appeared multiple times. This keeps your task list manageable.

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

5. **"Manage Recurring Tasks" is your control center** - see and edit scheduled tasks even when not visible

6. **Watch function checks every 30 seconds** - tasks appear automatically at scheduled times

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

*miniCycle v1.315+ | sparkinCreations | 2025*

**Guide Changelog:**
- v1.1 (Oct 2025): Added next occurrence display, catch-up function, two-state notifications, hybrid optimization
- v1.0 (Initial release): Core recurring functionality documentation