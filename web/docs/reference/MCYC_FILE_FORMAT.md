# .mcyc File Format Documentation

**Last Updated:** August 2026
**Normative spec:** <https://minicycle.app/pages/mcyc-format> (source: `web/pages/mcyc-format.html`)

> **This page is the long-form companion, not the specification.** The published page above
> is what third parties build against and what carries miniCycle's compatibility commitments.
> Where the two disagree, **the published page wins** and this file is the bug.
>
> **A `.mcyc` file is one routine.** Its root is `name` + `tasks` (plus optional `title`,
> `autoReset`, `deleteCheckedTasks`, `cycleCount`, `theme`, `recurringTemplates`), matching
> `/mcyc.schema.json`. Whole-app exports are a **different file type** — see
> [Full-state `.json` backups](#full-state-json-backups-not-mcyc), which are *not* `.mcyc`
> and are *not* accepted by the routine importer.

### Compatibility commitment

Quoted from the published spec, because it is a promise to anyone building on the format —
not an internal convention that can be revised by editing this file:

> *"Our intent for anything built on this: existing files keep importing. New fields may be
> added, so treat unknown keys as ignorable rather than as errors, which is also how the app
> treats them."*
>
> *"Each format version gets its own permanent URL (`/schema/mcyc-2.5.schema.json` today),
> and a version that has shipped is never edited in place."*

Two consequences worth stating plainly for anyone changing the importer:

- **A key that has ever been written must keep importing — permanently.** A rename adds an
  alias; it never replaces one. There is no deprecation window, because the commitment above
  has no end date.
- **A shipped `/schema/mcyc-*.schema.json` is immutable.** A new format version is a new file
  beside the old one, never an edit to it.

---

## Table of Contents

- [What is a .mcyc File?](#what-is-a-mcyc-file)
- [Creating .mcyc Files](#creating-mcyc-files)
  - [Method 1: Export from miniCycle (Recommended)](#method-1-export-from-minicycle-recommended)
  - [Method 2: Create Manually](#method-2-create-manually)
- [File Structure](#file-structure)
  - [Simple Format (Single Cycle)](#simple-format-single-cycle)
- [Full-state `.json` backups (not .mcyc)](#full-state-json-backups-not-mcyc)
- [Schema Reference](#schema-reference)
  - [Task Object](#task-object)
  - [Cycle Object](#cycle-object)
  - [Settings Object](#settings-object)
  - [Recurring Settings](#recurring-settings)
- [Examples](#examples)
- [Import/Export](#importexport)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## What is a .mcyc File?

A `.mcyc` (miniCycle) file is a **JSON-formatted file** that stores miniCycle routines. These files can be:

- **Shared** between users
- **Backed up** for safekeeping
- **Imported** into miniCycle for instant routine setup
- **Created manually** for custom workflows

**File Extension:** `.mcyc`
**MIME Type:** `application/json`
**Character Encoding:** UTF-8

---

## Creating .mcyc Files

The app writes `.mcyc` files from three places — **Share** (main menu), **Export**
(Settings), and **Download** (routine switcher). Since v2.343 all three use one
payload builder (`modules/utils/mcycPayload.js`); they differ in exactly one way:
whether `history` and `clearedTasks` are included. **Share asks the sender** at
share time ("Routine Only" vs "Include Full History", v2.345 — routine-only listed
first; see Security & Privacy below). Export and Download always include them
(backup semantics).

### Method 1: Export from miniCycle (Recommended)

The easiest way to create a `.mcyc` file is to export an existing cycle:

1. **Open miniCycle** in your browser
2. **Create your cycle** and add tasks
3. **Open Settings** (gear icon)
4. **Click "Export miniCycle"**
5. **File downloads** as `Cycle_Name.mcyc`

**Advantages:**
- ✅ Automatically generates valid structure
- ✅ Includes all settings and metadata
- ✅ Handles IDs and timestamps automatically
- ✅ No manual JSON editing required

---

### Method 2: Create Manually

For developers or advanced users, you can create `.mcyc` files manually:

#### **Quick Start (Minimal File):**

```json
{
  "name": "my_routine",
  "title": "My Daily Routine",
  "tasks": [
    {
      "id": "t1",
      "text": "First task",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "Second task",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Save as:** `My_Daily_Routine.mcyc`

---

## File Structure

A `.mcyc` file has exactly one shape: a single routine. (An older revision of this page
described a second "complete" `.mcyc` variant; that was wrong — see
[Full-state `.json` backups](#full-state-json-backups-not-mcyc).)

### Simple Format (Single Cycle)

The `.mcyc` format. Lightweight and easy to edit.

```json
{
  "name": "cycle_identifier",
  "title": "Display Name",
  "tasks": [ /* array of task objects */ ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Top-Level Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the cycle |
| `title` | string | No | Display name shown in UI. Falls back to `name` when omitted — `/mcyc.schema.json` requires only `name` and `tasks` |
| `tasks` | array | Yes | Array of task objects |
| `autoReset` | boolean | No | Auto-reset when all tasks complete (default: `true`) |
| `cycleCount` | number | No | Number of times cycle completed (default: `0`) |
| `deleteCheckedTasks` | boolean | No | To-Do mode: delete completed tasks (default: `false`) |

---

## Full-state `.json` backups (not .mcyc)

**This is a different file type, and it is not a `.mcyc` file.** It is included here because
people look for it on this page, but nothing exports it with a `.mcyc` extension and the
routine importer rejects it.

| | `.mcyc` routine | full-state backup |
|---|---|---|
| Extension | `.mcyc` | `.json` (forced by `backupRestoreManager`) |
| Contains | one routine | the whole app document |
| Written by | `cycleExportManager` via `buildMcycPayload()` | `backupRestoreManager` |
| Read by | the routine import button (`processImportedData`) | Settings → Restore, and the pre-boot rescue screen |
| Described by | `/mcyc.schema.json` | `docs/reference/SCHEMA_2_5.md` |

`processImportedData` opens with a hard gate:

```javascript
if (!importedData.name || !Array.isArray(importedData.tasks)) { /* rejected */ }
```

A full-state file has neither key at its root, so **handing one to the routine importer
produces "invalid format."** That is expected — restore it through Settings instead.

Its shape follows the app's stored document (see `SCHEMA_2_5.md`, which is normative for it):

```json
{
  "schemaVersion": "2.5",
  "metadata": { /* app metadata */ },
  "settings": { /* app settings */ },
  "data": {
    "cycles": {
      "cycle_id": { /* cycle object */ }
    }
  },
  "appState": { /* active cycle, mode */ },
  "userProgress": { /* achievements */ },
  "customReminders": { /* reminder settings */ }
}
```

**Use Cases:**
- Full app backup
- Migrating between devices
- Sharing complete configurations
- Testing/development

---

## Schema Reference

### Task Object

> **"Required" here means "present in every file miniCycle exports"** — not "rejected if absent."
> The only fields the importer actually enforces are the top-level `name` and `tasks`.
> A task missing `id` gets one generated, non-string `text` is coerced, and `schemaVersion`
> is set for you. Author the required fields anyway; just do not expect an error if you skip one.

Every task in the `tasks` array uses this structure:

```json
{
  "id": "t1",
  "text": "Task description",
  "completed": false,
  "schemaVersion": 2,
  "dueDate": null,
  "highPriority": false,
  "priorityColor": null,
  "remindersEnabled": false,
  "recurring": false,
  "recurringSettings": {},
  "deleteWhenComplete": false,
  "deleteWhenCompleteSettings": {
    "cycle": false,
    "todo": true
  }
}
```

**Properties:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | string | **Yes** | - | Unique task ID (e.g., `"t1"`, `"t2"`) |
| `text` | string | **Yes** | - | Task description (emojis supported 🎯) |
| `completed` | boolean | **Yes** | `false` | Completion status |
| `schemaVersion` | number | **Yes** | `2` | Task schema version |
| `dueDate` | string\|null | No | `null` | ISO 8601 date string |
| `highPriority` | boolean | No | `false` | Priority flag |
| `priorityColor` | string\|null | No | `null` | Hex color for priority border (e.g., `"#dc3545"`) |
| `remindersEnabled` | boolean | No | `false` | Enable reminders for this task |
| `recurring` | boolean | No | `false` | Is this a recurring task? |
| `recurringSettings` | object | No | `{}` | Recurring configuration (see below) |
| `deleteWhenComplete` | boolean | No | *derived* | **Do not author this.** It mirrors whichever `deleteWhenCompleteSettings` entry matches the routine's current mode, and `routineLoader` re-derives it on **every** load. A file that sets only this field imports looking correct, then loses the value the first time the routine opens. |
| `deleteWhenCompleteSettings` | object | No | recurring: `{"cycle": true, "todo": true}`<br>otherwise: `{"cycle": false, "todo": true}` | Per-mode deletion behavior, and the **durable** setting. The import default depends on `recurring` (cycleImportManager) — a recurring occurrence is removed on reset so the schedule can bring it back. |

---

### Cycle Object

In a full-state backup each cycle is stored under `data.cycles` (in a `.mcyc`, the routine
*is* the root object and there is no such map):

```json
{
  "id": "cycle_1234567890",
  "title": "Morning Routine",
  "tasks": [ /* array of tasks */ ],
  "autoReset": true,
  "deleteCheckedTasks": false,
  "cycleCount": 0,
  "createdAt": 1234567890,
  "taskOptionButtons": null,
  "recurringTemplates": {},
  "reminders": null,
  "theme": "classic",
  "history": {
    "events": [],
    "maxEvents": 100
  },
  "clearedTasks": {
    "entries": [],
    "totalCleared": 0,
    "autoPruneEnabled": true
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | **Yes** | Internal cycle ID. **Not** the `cycles` map key — cycles are keyed by **title** (creation, rename, duplication, and import all write `cycles[title]`), and this field is currently not read by the app |
| `title` | string | **Yes** | Display name |
| `tasks` | array | **Yes** | Array of task objects |
| `autoReset` | boolean | No | Auto-reset behavior. **Import default is `true`** — the importer reads it as `!== false`, so a file that omits this field becomes an *Auto* routine. Write `false` explicitly for Manual. |
| `deleteCheckedTasks` | boolean | No | To-Do mode behavior |
| `cycleCount` | number | No | Times completed |
| `createdAt` | number | No | Unix timestamp (milliseconds) |
| `taskOptionButtons` | object\|null | No | Per-cycle task button visibility settings |
| `recurringTemplates` | object | No | Recurring task templates |
| `reminders` | object\|null | No | Per-routine reminder configuration |
| `theme` | string | No | Vocabulary theme identifier (default: `"classic"`) |
| `history` | object | No | Per-routine activity log (v1.685+) |
| `clearedTasks` | object | No | Cleared tasks tracking (To-Do mode + cycle reset auto-removes) (v1.685+) |

### History Object (v1.685+)

Per-routine history tracking. Travels with **backup** exports (Settings → Export,
routine download). On Share it's the **sender's choice** at share time (v2.345;
v2.342–v2.344 stripped it unconditionally — privacy: a shared routine usually
carries its structure, not the owner's event log). On import,
each event's `details` object is reduced to an **allowlist** of the keys the
history renderer actually reads (v2.343); unknown keys are dropped.

```json
{
  "events": [
    {
      "id": "evt-1704567890123-abc12",
      "type": "cycle_completed",
      "timestamp": 1704567890123,
      "details": {
        "cycleCount": 42,
        "cycleName": "Morning Routine"
      }
    }
  ],
  "maxEvents": 100
}
```

**Event Types:**
- `cycle_completed` - Routine cycle completed
- `tasks_cleared` - Tasks cleared in To-Do mode
- `achievement_unlocked` - Achievement milestone reached

### Cleared Tasks Object (v1.685+)

Per-routine tracking of cleared tasks in To-Do mode. Travels with **backup**
exports (Settings → Export, routine download). On Share it's the **sender's
choice** at share time (v2.345; v2.342–v2.344 stripped it unconditionally —
privacy: a shared routine usually shouldn't carry the owner's cleared task names).

```json
{
  "entries": [
    {
      "id": "clr-1704567890123-xyz98",
      "taskText": "Buy groceries",
      "clearedAt": 1704567890123,
      "wasHighPriority": true,
      "hadDueDate": false,
      "dueDate": null,
      "priorityColor": "#dc3545",
      "remindersEnabled": false,
      "deleteWhenComplete": false,
      "deleteWhenCompleteSettings": { "cycle": false, "todo": true },
      "recurring": false,
      "recurringSettings": null,
      "clearedInMode": "todo"
    }
  ],
  "totalCleared": 147,
  "autoPruneEnabled": true
}
```

**⚠️ Field-name trap:** a cleared entry's text lives in **`taskText`** — *not*
`text`, which is the field on live tasks. An earlier version of this spec showed
`text` here, and the importer written against that shape rendered round-tripped
cleared history blank (fixed v2.342; the importer still accepts `text` as a
legacy alias when reading old files).

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `entries` | array | Recent cleared tasks (auto-pruned after 90 days) |
| `taskText` | string | The cleared task's text (see trap above) |
| `wasHighPriority` / `hadDueDate` / `dueDate` / `priorityColor` / `remindersEnabled` / `deleteWhenComplete` / `deleteWhenCompleteSettings` / `recurring` / `recurringSettings` / `clearedInMode` | various | Full metadata `_buildClearedEntry()` records, so **Recreate** rebuilds the task with settings intact. Since v2.342 the importer preserves all of these (validated) rather than dropping them |
| `totalCleared` | number | Lifetime count of cleared tasks (persists through prune) |
| `autoPruneEnabled` | boolean | Whether to auto-remove entries older than 90 days |

---

### Settings Object

Application-wide settings. These live in a **full-state backup only** — a `.mcyc` carries no
`settings` object:

```json
{
  "theme": null,
  "darkMode": false,
  "alwaysShowRecurring": false,
  "autoSave": true,
  "defaultRecurringSettings": {
    "frequency": null,
    "indefinitely": true,
    "time": null
  },
  "unlockedThemes": [],
  "unlockedFeatures": [],
  "notificationPosition": { "x": 0, "y": 0 },
  "notificationPositionModified": false,
  "accessibility": {
    "reducedMotion": false,
    "highContrast": false,
    "screenReaderHints": false
  }
}
```

---

### Recurring Settings

For tasks with `recurring: true` (Schema 2.5+ structure, updated v1.349):

```json
{
  "frequency": "daily",
  "indefinitely": true,
  "count": null,
  "untilDate": null,
  "time": {
    "hour": 9,
    "minute": 0,
    "meridiem": "AM",
    "military": false
  },
  "specificDates": {
    "enabled": false,
    "dates": []
  },
  "hourly": {
    "useSpecificMinute": false,
    "minute": 0
  },
  "weekly": {
    "days": ["Mon", "Wed", "Fri"]
  },
  "biweekly": {
    "week1": ["Mon", "Wed"],
    "week2": ["Tue", "Thu"],
    "referenceDate": "2025-01-06T00:00:00.000Z"
  },
  "monthly": {
    "useSpecificDays": true,
    "days": [1, 15],
    "lastDay": false,
    "useWeekOfMonth": false,
    "weekOfMonth": null
  },
  "yearly": {
    "months": [1, 6, 12],
    "useSpecificDays": true,
    "daysByMonth": {
      "1": [1, 15],
      "6": [1],
      "12": [25]
    },
    "applyDaysToAll": false
  }
}
```

**Core Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `frequency` | string | Yes | `"hourly"`, `"daily"`, `"weekly"`, `"biweekly"`, `"monthly"`, `"yearly"` |
| `indefinitely` | boolean | Yes | `true` to recur forever, `false` to use count/untilDate |
| `count` | number\|null | No | Number of times to recur (if not indefinite) |
| `untilDate` | string\|null | No | End date in YYYY-MM-DD format (NEW v1.349+) |
| `time` | object\|null | No | Specific time of day (see Time Object below) |

**Time Object (optional):**

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `hour` | number | 1-12 | Hour in 12-hour format (or 0-23 if military) |
| `minute` | number | 0-59 | Minute |
| `meridiem` | string | `"AM"`/`"PM"` | AM/PM (ignored if military=true) |
| `military` | boolean | `true`/`false` | Use 24-hour format |

**Frequency-Specific Settings:**

**Hourly:**
```json
"hourly": {
  "useSpecificMinute": true,
  "minute": 30
}
```

**Weekly:**
```json
"weekly": {
  "days": ["Mon", "Wed", "Fri"]
}
```
- `days`: Array of day abbreviations (`"Sun"`, `"Mon"`, `"Tue"`, `"Wed"`, `"Thu"`, `"Fri"`, `"Sat"`)

**Biweekly (v1.348+):**
```json
"biweekly": {
  "week1": ["Mon", "Wed"],
  "week2": ["Tue", "Thu"],
  "referenceDate": "2025-01-06T00:00:00.000Z"
}
```
- `week1`: Days for even weeks (0, 2, 4, ...)
- `week2`: Days for odd weeks (1, 3, 5, ...)
- `referenceDate`: ISO 8601 timestamp for week 0 starting point
- **New in v1.348:** Separate day selections for each week in two-week cycle
- Uses DST-safe date calculation

**Monthly (v1.349+):**
```json
// Option A: Specific days with optional last day
"monthly": {
  "useSpecificDays": true,
  "days": [1, 15, 30],
  "lastDay": false
}

// Option B: Week-of-month pattern
"monthly": {
  "useWeekOfMonth": true,
  "weekOfMonth": {
    "ordinal": "2",    // "1", "2", "3", "4", or "last"
    "day": "Tue"       // "Sun", "Mon", "Tue", ..., "Sat"
  }
}
```
- `useSpecificDays`: Boolean, whether using specific day numbers
- `days`: Array of day numbers (1-31)
- `lastDay`: Boolean, include last day of month (NEW v1.349+)
- `useWeekOfMonth`: Boolean, whether using week-of-month pattern (NEW v1.349+)
- `weekOfMonth`: Object with ordinal and day for patterns like "2nd Tuesday" (NEW v1.349+)
  - `ordinal`: String `"1"`, `"2"`, `"3"`, `"4"`, or `"last"`
  - `day`: Day abbreviation (`"Sun"` through `"Sat"`)

**Yearly:**
```json
"yearly": {
  "months": [1, 6, 12],
  "useSpecificDays": true,
  "daysByMonth": {
    "1": [1, 15],
    "6": [1],
    "12": [25]
  },
  "applyDaysToAll": false
}
```
- `months`: Array of month numbers (1-12)
- `useSpecificDays`: Whether to use specific days
- `daysByMonth`: Object mapping month number to array of days
- `applyDaysToAll`: If true, uses `daysByMonth.all` for all months

---

## Examples

### Example 1: Simple Morning Routine

```json
{
  "name": "morning_routine",
  "title": "🌅 Morning Routine",
  "tasks": [
    {
      "id": "t1",
      "text": "🛏️ Make bed",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "🪥 Brush teeth",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t3",
      "text": "☕ Coffee & breakfast",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "📧 Check emails",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Morning_Routine.mcyc`

---

### Example 2: Workout Routine with Recurring Tasks

```json
{
  "name": "workout_routine",
  "title": "💪 Weekly Workout",
  "tasks": [
    {
      "id": "t1",
      "text": "🏃 Cardio - 30 minutes",
      "completed": false,
      "schemaVersion": 2,
      "recurring": true,
      "recurringSettings": {
        "frequency": "weekly",
        "indefinitely": true,
        "count": null,
        "time": {
          "hour": 7,
          "minute": 0,
          "meridiem": "AM",
          "military": false
        },
        "weekly": {
          "days": ["Mon", "Wed", "Fri"]
        }
      }
    },
    {
      "id": "t2",
      "text": "🏋️ Strength training",
      "completed": false,
      "schemaVersion": 2,
      "recurring": true,
      "recurringSettings": {
        "frequency": "biweekly",
        "indefinitely": true,
        "count": null,
        "time": {
          "hour": 7,
          "minute": 0,
          "meridiem": "AM",
          "military": false
        },
        "biweekly": {
          "week1": ["Mon", "Wed", "Fri"],
          "week2": ["Tue", "Thu"],
          "referenceDate": "2025-01-06T00:00:00.000Z"
        }
      }
    },
    {
      "id": "t3",
      "text": "🧘 Stretching & cooldown",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": false,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Weekly_Workout.mcyc`

---

### Example 3: Project Checklist (To-Do Mode)

```json
{
  "name": "project_launch",
  "title": "🚀 Product Launch Checklist",
  "tasks": [
    {
      "id": "t1",
      "text": "✅ Finalize feature set",
      "completed": false,
      "schemaVersion": 2,
      "highPriority": true,
      "priorityColor": "#dc3545"
    },
    {
      "id": "t2",
      "text": "🧪 Complete QA testing",
      "completed": false,
      "schemaVersion": 2,
      "dueDate": "2025-02-01T17:00:00Z"
    },
    {
      "id": "t3",
      "text": "📝 Write documentation",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "🎉 Launch announcement",
      "completed": false,
      "schemaVersion": 2,
      "highPriority": true,
      "priorityColor": "#facc15",
      "dueDate": "2025-02-15T12:00:00Z"
    }
  ],
  "autoReset": false,
  "cycleCount": 0,
  "deleteCheckedTasks": true
}
```

**Filename:** `Product_Launch_Checklist.mcyc`

**Note:** `deleteCheckedTasks: true` enables To-Do mode where completed tasks are deleted.

---

### Example 4: Recipe (Step-by-Step)

```json
{
  "name": "pancake_recipe",
  "title": "🥞 Fluffy Pancakes Recipe",
  "tasks": [
    {
      "id": "t1",
      "text": "Mix 2 cups flour, 2 tbsp sugar, 2 tsp baking powder, 1 tsp salt",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "Whisk 2 eggs, 1.5 cups milk, 4 tbsp melted butter",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t3",
      "text": "Combine wet and dry ingredients (don't overmix!)",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "Heat griddle to medium heat, lightly oil",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t5",
      "text": "Pour 1/4 cup batter per pancake",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t6",
      "text": "Flip when bubbles form (2-3 minutes)",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t7",
      "text": "Cook until golden brown on both sides",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t8",
      "text": "🍯 Serve with butter and maple syrup!",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Fluffy_Pancakes_Recipe.mcyc`

---

## Import/Export

### Exporting from miniCycle

1. **Open Settings** (⚙️ icon)
2. **Click "Export miniCycle"**
3. **File downloads** as `Cycle_Name.mcyc`
4. **Location:** Your browser's download folder

### Importing into miniCycle

**Method 1: Import Button**
1. **Open Settings** (⚙️ icon)
2. **Click "Import miniCycle"**
3. **Select `.mcyc` file**
4. **Cycle loads automatically**

**Method 2: Onboarding**
1. **First launch** or after clearing data
2. **Choose "Import existing cycle"**
3. **Select `.mcyc` file**
4. **Start using immediately**

**Method 3: Drag & Drop** (if supported)
1. **Drag `.mcyc` file** into miniCycle window
2. **Confirm import**
3. **Cycle loads**

**Method 4: Open from Desktop (PWA)**
1. **Install miniCycle as a PWA** (Chromium browsers — Chrome, Edge, etc.)
2. **Double-click a `.mcyc` file** in your file explorer
3. **miniCycle opens** and imports the routine automatically
4. Requires the `file_handlers` entry in `manifest.json`

> **Note:** This method only works when the app is installed as a PWA. The OS file association is registered via the [File Handling API](https://developer.chrome.com/docs/capabilities/web-apis/file-handling).

---

### Import Security

When importing `.mcyc` files, miniCycle applies several layers of validation and sanitization:

- **JSON validation:** Files that are not valid JSON are rejected with a clear error message
- **File size limit:** Maximum 10 MB per file
- **Task count limit:** Excess tasks beyond 150 are truncated (not rejected)
- **Text sanitization:** All task text and cycle names are trimmed and enforced to length limits at import. HTML is **not** stripped or escaped here — XSS safety lives at the render sinks (`textContent` for user data; `escapeHtml()` before any innerHTML interpolation), which escape imported text wherever it is displayed
- **Field allowlisting:** `taskOptionButtons` and `reminders` are sanitized to only allow known keys with expected types — unknown fields are stripped
- **Storage quota check:** Import is blocked if insufficient localStorage space is available
- **Recurring template security:** Only safe metadata fields (`id`, `createdAt`, `updatedAt`) are kept from imported templates; all text comes from the sanitized source

---

## Best Practices

### File Naming

✅ **Good:**
```
Morning_Routine.mcyc
Weekly_Workout_Plan.mcyc
Grocery_Shopping_List.mcyc
```

❌ **Avoid:**
```
my file.mcyc              // Spaces cause issues
new.mcyc                  // Not descriptive
cycle@2024!.mcyc          // Special characters
```

**Pattern:** `{Descriptive_Name}.mcyc`

---

### Task IDs

✅ **Good:**
```json
"id": "t1"
"id": "t2"
"id": "task-morning-1"
```

❌ **Avoid:**
```json
"id": "1"           // Too generic
"id": ""            // Empty
// Missing id        // Required field
```

**Rules:**
- Must be unique within the cycle
- String type (not number)
- Sequential or descriptive

---

### Text Content

✅ **Use emojis** for visual appeal:
```json
"text": "🏃 Go for a run"
"text": "📧 Check emails"
"text": "🥗 Prepare healthy lunch"
```

✅ **Be descriptive:**
```json
"text": "Review quarterly goals and update OKRs"
```

❌ **Too vague:**
```json
"text": "Do stuff"
"text": "Work"
```

---

### Mode Selection

Choose the right mode for your use case:

**Auto-Reset Mode** (`autoReset: true`):
- Daily routines
- Repeatable processes
- Habits and rituals
```json
"autoReset": true,
"deleteCheckedTasks": false
```

**Manual Cycle Mode** (`autoReset: false`):
- Workflows you control
- Multi-step projects
- Flexible routines
```json
"autoReset": false,
"deleteCheckedTasks": false
```

**To-Do Mode** (`deleteCheckedTasks: true`):
- One-time checklists
- Project tasks
- Shopping lists
```json
"autoReset": false,
"deleteCheckedTasks": true
```

---

### Validation

Before sharing `.mcyc` files, validate them:

**Online JSON Validators:**
- https://jsonlint.com/
- https://jsonformatter.curiousconcept.com/

**Command Line:**
```bash
# Using Python
python3 -m json.tool Morning_Routine.mcyc

# Using Node.js
node -e "console.log(JSON.parse(require('fs').readFileSync('Morning_Routine.mcyc')))"
```

**In miniCycle:**
- Import the file
- Check for error notifications
- Verify tasks appear correctly

---

## Troubleshooting

### Common Issues

**1. "Invalid file format" error**

**Cause:** Malformed JSON
**Fix:** Validate JSON syntax
```bash
python3 -m json.tool your_file.mcyc
```

---

**2. "Missing required fields" error**

**Cause:** Missing `id`, `text`, or `schemaVersion`
**Fix:** Ensure every task has:
```json
{
  "id": "t1",
  "text": "Task description",
  "schemaVersion": 2
}
```

---

**3. Tasks don't appear after import**

**Cause:** Empty `tasks` array
**Fix:** Ensure tasks array is not empty:
```json
"tasks": [
  {
    "id": "t1",
    "text": "At least one task",
    "completed": false,
    "schemaVersion": 2
  }
]
```

---

**4. Recurring tasks don't work**

**Cause:** Invalid `recurringSettings`
**Fix:** Use valid frequency and proper format:
```json
"recurring": true,
"recurringSettings": {
  "frequency": "daily",
  "indefinitely": true,
  "time": "09:00"
}
```

Valid frequencies: `"daily"`, `"weekly"`, `"monthly"`

---

**5. File won't download**

**Cause:** Browser blocking download
**Fix:**
- Check browser's download permissions
- Disable popup blocker for miniCycle
- Try a different browser

---

**6. Special characters display incorrectly**

**Cause:** Wrong file encoding
**Fix:** Save file as **UTF-8** encoding
```bash
# Convert to UTF-8 (Mac/Linux)
iconv -f ISO-8859-1 -t UTF-8 input.mcyc > output.mcyc
```

---

## Advanced: Creating .mcyc Files Programmatically

### Node.js Script

```javascript
const fs = require('fs');

function createMcycFile(cycleName, tasks, options = {}) {
  const timestamp = Date.now();
  const cycleId = `cycle_${timestamp}`;

  const mcycData = {
    name: cycleId,
    title: cycleName,
    tasks: tasks.map((text, index) => ({
      id: `t${index + 1}`,
      text: text,
      completed: false,
      schemaVersion: 2,
      dueDate: options.dueDates?.[index] || null,
      highPriority: options.priorities?.[index] || false,
      priorityColor: options.priorityColors?.[index] || null
    })),
    autoReset: options.autoReset !== false,
    cycleCount: 0,
    deleteCheckedTasks: options.deleteCheckedTasks || false
  };

  const filename = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;
  fs.writeFileSync(filename, JSON.stringify(mcycData, null, 2), 'utf8');
  console.log(`✅ Created: ${filename}`);
  return filename;
}

// Example usage:
createMcycFile('Morning Routine', [
  '🌅 Wake up at 6 AM',
  '🪥 Brush teeth',
  '🏃 Morning jog - 20 min',
  '🥣 Healthy breakfast',
  '📧 Check emails',
  '📝 Plan the day'
], {
  autoReset: true,
  priorities: [false, false, true, false, false, true]
});
```

**Run:**
```bash
node create-mcyc.js
```

---

### Python Script

```python
import json
import time

def create_mcyc_file(cycle_name, tasks, auto_reset=True, delete_checked=False):
    timestamp = int(time.time() * 1000)
    cycle_id = f"cycle_{timestamp}"

    mcyc_data = {
        "name": cycle_id,
        "title": cycle_name,
        "tasks": [
            {
                "id": f"t{i+1}",
                "text": task,
                "completed": False,
                "schemaVersion": 2
            }
            for i, task in enumerate(tasks)
        ],
        "autoReset": auto_reset,
        "cycleCount": 0,
        "deleteCheckedTasks": delete_checked
    }

    filename = f"{cycle_name.replace(' ', '_')}.mcyc"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(mcyc_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Created: {filename}")
    return filename

# Example usage:
create_mcyc_file('Evening Routine', [
    '🍽️ Prepare dinner',
    '📺 Relax time',
    '📚 Read for 30 minutes',
    '🛁 Evening shower',
    '🌙 Bedtime routine'
])
```

**Run:**
```bash
python3 create_mcyc.py
```

---

## Version history

**Two version lines exist and they move independently.** Conflating them is the single
easiest mistake to make here.

### App data schema — the stored document

Versions the app's own state has passed through. This is what "Schema 2.5" refers to
everywhere else in the docs, and it is *not* stamped on a `.mcyc` file.

| Version | Date | Changes |
|---------|------|---------|
| **2.5** | Jan 2025 | Current stable version |
| **2.0** | Oct 2024 | Added recurring tasks, settings |
| **1.0** | 2023 | Initial schema |

Older stored data is migrated forward automatically on load (`migrationManager.js`).

### `.mcyc` file format

A `.mcyc` document carries **no format-version field**. Tasks inside it carry an integer
`schemaVersion` (currently `2`) — a third, separate line again. Readers should detect
capability by key presence, not by a version stamp.

| Schema document | Status |
|---|---|
| [`/mcyc.schema.json`](https://minicycle.app/mcyc.schema.json) | Rolling; tracks the current format. May gain fields. |
| [`/schema/mcyc-2.5.schema.json`](https://minicycle.app/schema/mcyc-2.5.schema.json) | Pinned and **immutable**. Pin this for CI. |

**Backward compatibility:** existing files keep importing — see
[Compatibility commitment](#compatibility-commitment) at the top of this page.

---

## File Size Limits

**Recommended:**
- Tasks per cycle: < 100
- File size: < 1 MB
- Cycles in complete export: < 50

**Technical Limits:**
- localStorage: ~5-10 MB per origin
- JSON nesting: Avoid deep nesting (< 5 levels)

---

## Security & Privacy

**Safe:**
- ✅ `.mcyc` files contain only task data
- ✅ No personal information required
- ✅ No network requests
- ✅ Stored locally in browser

**Sharing:**
- ✅ Since v2.345, **Share asks the sender** what leaves the device: "Routine
  Only" (structure — tasks, settings, recurring templates) or "Include Full
  History" (also the event log + cleared-task records). Routine-only is listed
  first and is the fallback default. (v2.342–v2.344 stripped unconditionally;
  before v2.342 shares silently included everything)
- ⚠️ **Backup files are different**: Export and Download keep history and cleared
  tasks (they exist for your own restore) — review before handing one to someone else
- ⚠️ Task text itself always travels — review content before sharing
- ⚠️ Use descriptive but generic names

---

## Resources

**Sample Files:**
- `examples/sample-routines/*.mcyc` - Sample routines (auto-discovered via `manifest.json`)
- See [Sample Routines Guide](../features/SAMPLE_ROUTINES.md) for adding new samples

**Documentation:**
- `WHAT_IS_MINICYCLE.md` - App overview
- `QUICK_REFERENCE.md` - Feature guide
- `DEVELOPER_DOCUMENTATION.md` - Technical details

**Support:**
- GitHub: https://github.com/sparkinCreations/miniCycle
- In-app: Settings → Diagnostics & Testing

---

## Version

**Document Version:** 1.4
**Schema Version:** 2.5

**Last Updated:** July 2026

---

> **Planned change:** [SCHEMA_2_6_PLAN.md](../future-work/SCHEMA_2_6_PLAN.md) renames the
> per-task `deleteWhenCompleteSettings` to `autoClear` and drops the derived
> `deleteWhenComplete` mirror. That change **does** alter this format, so it adds a
> `schema/mcyc-2.6.schema.json` and leaves the pinned 2.5 schema untouched. The
> `cycles` → `routine` rename in that same plan does **not** affect this format.

---

**Happy task cycling! 🎯**
