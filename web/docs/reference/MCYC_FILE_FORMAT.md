# .mcyc File Format Documentation

**Last verified:** Nov 10 2026

Format 2.6 shipped with app v2.573 on September 19, 2026 (priority as a level, one `autoClear` map; every 2.5 spelling still imports).

**Normative spec:** <https://minicycle.app/pages/mcyc-format> (source: `web/pages/mcyc-format.html`)

> **This page is the long-form companion, not the specification.** The published page above
> is what third parties build against and what carries miniCycle's compatibility commitments.
> Where the two disagree, **the published page wins** and this file is the bug.
>
> **A `.mcyc` file is one routine.** Its root is `name` + `tasks` (plus optional `title`,
> `autoReset`, `deleteCheckedTasks`, `cycleCount`, `theme`, `recurringTemplates`), matching
> `/mcyc.schema.json`. The app's own exports add more optional root keys; see
> [Top-Level Properties](#simple-format-single-cycle). Whole-app exports are a **different file type** — see
> [Full-state `.json` backups](#full-state-json-backups-not-mcyc), which are *not* `.mcyc`
> and are *not* accepted by the routine importer.

### Compatibility commitment

Quoted from the published spec, because it is a promise to anyone building on the format —
not an internal convention that can be revised by editing this file:

> *"Our intent for anything built on this: existing files keep importing. New fields may be
> added, so treat unknown keys as ignorable rather than as errors, which is also how the app
> treats them."*
>
> *"Each format version gets its own permanent URL (`/schema/mcyc-2.6.schema.json` today),
> and a version that has shipped is never edited in place."*

**Format versions.** 2.5 (`/schema/mcyc-2.5.schema.json`, immutable) stores priority as a
flag plus a colour and the clear setting as a map plus a derived mirror. **2.6 (Sep 2026,
`/schema/mcyc-2.6.schema.json`)** stores priority as a LEVEL (`priority`) and the clear
setting as one open map (`autoClear`). Every 2.5 spelling is still read — permanently. The
exporter wrote both spellings from Sep 19 to Oct 13 2026 while older platform builds were in
use; since then it writes only the 2.6 fields. When both are present on import the 2.6 field wins.

**Dual-write window CLOSED Oct 13, 2026.** `utils/mcycPayload.js` now writes only the 2.6 spellings
(`priority`, `autoClear`); the importer's 2.5 readers (`getLegacyPriorityLevel`,
`deleteWhenCompleteSettings`) and the pinned 2.5 schema are untouched — those are the compatibility
promise, not the transition. The decision record that led here is kept below as written.

*Closing the dual-write window (decided Sep 19, 2026).* The extra pair protects exactly one
case: a file written by a current build and opened by a reader that knows only the 2.5
spelling, which still imports but loses priority and clear settings to their defaults. Web
cannot be that reader (the service worker keeps it current), Lite does not import `.mcyc`, and
the iOS and Android builds shipped with 2.6 (v2.573 and v2.574 went to all four platforms).
Drop the pair in the first release after BOTH hold: the Chrome Web Store listing has been on
2.573 or later for about a week, and no `.mcyc` has been handed to anyone on an older build.
Expected early-to-mid October 2026. Doing it means three things together: remove the four
legacy fields from `utils/mcycPayload.js` (`highPriority`, `priorityColor`,
`deleteWhenCompleteSettings`, `deleteWhenComplete`), reword this note and the matching line on
the published spec page with the date, and leave the importer's 2.5 readers
(`getLegacyPriorityLevel`, `deleteWhenCompleteSettings`) and the pinned 2.5 schema exactly as
they are — those are the compatibility promise, not the transition.

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

**File Extension:** `.mcyc` (the import picker, drag and drop and the PWA file handler also accept `.json`; Share names its file `<title>.mcyc.json` because share targets reject unknown extensions)
**MIME Type:** `application/json`
**Character Encoding:** UTF-8

---

## Creating .mcyc Files

The app writes `.mcyc` files from three places — **Share** and **Download** in the
main menu's Routine Actions section, and the download action in the routine
switcher. Since v2.343 all three use one payload builder, `buildMcycPayload()`
(`modules/utils/mcycPayload.js`); they differ in exactly one way:
whether `history` and `clearedTasks` are included. **Share asks the sender** at
share time ("Routine Only" vs "Include Full History", v2.345 — routine-only listed
first; see Security & Privacy below). Both download paths always include them
(backup semantics).

### Method 1: Export from miniCycle (Recommended)

The easiest way to create a `.mcyc` file is to export an existing cycle:

1. **Open miniCycle** in your browser
2. **Create your cycle** and add tasks
3. **Open the main menu** and expand **Routine Actions**
4. **Click "Download"** and confirm
5. **The file is saved** under the routine's title with a `.mcyc` extension (a save
   dialog where the browser has one, a plain download otherwise). `buildMcycFilename()`
   keeps the title as written, Unicode and spaces included, and replaces only the
   characters a filename cannot hold

**Advantages:**
- ✅ Automatically generates valid structure
- ✅ Includes the routine's settings, recurring templates, history and cleared tasks
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

**Save as:** My_Daily_Routine.mcyc

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
| `name` | string | Yes | Identifier for the routine. Must be present and non-empty or the file is rejected. An exported file carries the routine's storage key here; the importer never reuses it as a key (it generates a new id) and reads it only as the fallback for `title` |
| `title` | string | No | Display name shown in UI. Falls back to `name` when omitted — `/mcyc.schema.json` requires only `name` and `tasks` |
| `tasks` | array | Yes | Array of task objects |
| `autoReset` | boolean | No | Auto-reset when all tasks complete (default: `true`) |
| `cycleCount` | number | No | Number of times cycle completed (default: `0`) |
| `deleteCheckedTasks` | boolean | No | To-Do mode: delete completed tasks (default: `false`) |

The app's own exports also write these optional root keys, and the importer reads
each of them (see [Cycle Object](#cycle-object) for the shapes):

| Property | Type | Description |
|----------|------|-------------|
| `theme` | string | Vocabulary theme id (default `"classic"`). A theme the importing user has not unlocked falls back to their default theme, and an unknown id to `"classic"` |
| `taskOptionButtons` | object\|null | Which option buttons show on a task row |
| `recurringTemplates` | object | Recurring templates keyed by task id. Usually omit: see [Import Security](#import-security) for what is kept |
| `reminders` | object\|null | Per-routine reminder settings |
| `autoUncheckDaily` | object\|null | Auto-Uncheck Daily settings: `enabled`, `hour`, `minute`. The importer resets the runtime fields `lastResetDate` and `pendingNotification` |
| `createdAt` | number\|null | When the routine was created. Written on export; the importer stamps its own time instead |
| `history` | object\|null | Activity log. Present only in downloads and in shares sent with "Include Full History" |
| `clearedTasks` | object\|null | Cleared-task records. Same rule as `history` |

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
| Read by | the routine import button (`processImportedData`) | Settings → Data Management → Restore All Routines, the first-run screen's "Restore from a backup file", and the pre-boot rescue screen |
| Described by | `/mcyc.schema.json` | `docs/reference/SCHEMA_2_6.md` |

`processImportedData` opens with a hard gate:

```javascript
if (!importedData.name || !Array.isArray(importedData.tasks)) { /* rejected */ }
```

A full-state file has neither key at its root, so **handing one to the routine importer
produces "invalid format."** That is expected — restore it through Settings instead.

It is a wrapper around the app's stored document, built by `buildBackupFile()` in
`backupRestoreManager`:

```json
{
  "schemaVersion": "2.6",
  "miniCycleData": "{ \"schemaVersion\": \"2.6\", \"metadata\": { }, \"settings\": { }, \"data\": { \"routine\": { } }, \"appState\": { } }",
  "backupMetadata": {
    "createdAt": 1789760998636,
    "version": "<app version>",
    "schemaVersion": "2.6",
    "includesLiteStorage": false,
    "source": "miniCycle App"
  }
}
```

`miniCycleData` is a **string**: the whole stored document, serialized. Its shape is
described in [SCHEMA_2_6.md](SCHEMA_2_6.md), which is normative for it. A backup may
also carry a `liteStorage` object (the Lite app's keys). A backup made before 2.6 holds
a 2.5 document (`data.cycles`, `appState.activeCycleId`); restore accepts it and the
app migrates it on the next boot.

**Use Cases:**
- Full app backup
- Migrating between devices
- Testing/development

---

## Schema Reference

### Task Object

> **"Required" here means "present in every file miniCycle exports"** — not "rejected if absent."
> The only fields the importer actually enforces are the top-level `name` and `tasks`.
> A task missing `id` gets one generated (so does one whose `id` is not 1 to 64 characters
> of letters, digits, `.`, `_`, `:` or `-`), non-string `text` is coerced, and `schemaVersion`
> is set for you. Author the required fields anyway; just do not expect an error if you skip one.

Every task in the `tasks` array uses this structure:

```json
{
  "id": "t1",
  "text": "Task description",
  "completed": false,
  "schemaVersion": 2,
  "dueDate": null,
  "priority": null,
  "remindersEnabled": false,
  "recurring": false,
  "recurringSettings": {},
  "autoClear": {
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
| `dueDate` | string\|null | No | `null` | ISO 8601 date string. The app stores and exports a plain date (`"YYYY-MM-DD"`); a full timestamp is accepted and cut to its date. Anything else imports as `null` |
| `dueTime` | string\|null | No | `null` | Due time of day, `"HH:MM"` 24-hour local time (e.g. `"15:30"`), only meaningful beside a `dueDate`. Written since Oct 2026, kept as its own key so `dueDate` stays a plain date: a reader that predates it ignores the key and treats the task as date-only (notification at 9:00, overdue from the next day). Malformed values, or a time with no date, import as `null`. Not in the immutable 2.6 schema file; the schema's open task object accepts it. |
| `priority` | string\|null | No | `null` | Priority LEVEL: `"high"`, `"medium"`, `"low"` or `null`. The app shows it as the reader's theme colour for that level — no colour travels in the file. *(2.5 spelling, still accepted: `highPriority` + `priorityColor`; a swatch colour of any theme names its level, any other hex its colour family; ignored when `priority` is present.)* |
| `remindersEnabled` | boolean | No | `false` | Enable reminders for this task |
| `recurring` | boolean | No | `false` | Is this a recurring task? |
| `recurringSettings` | object | No | `{}` | Recurring configuration (see below) |
| `autoClear` | object | No | recurring: `{"cycle": true, "todo": true}`<br>otherwise: `{"cycle": false, "todo": true}` | Whether the task is REMOVED (rather than unchecked) when the routine resets (`cycle`, the Auto and Manual modes) or completed tasks are cleared (`todo`). An OPEN map: a boolean under any other key is carried through. *(2.5 spelling, still accepted: `deleteWhenCompleteSettings`, and a derived `deleteWhenComplete` mirror that is ignored on import; both ignored when `autoClear` is present.)* |

---

### Cycle Object

In the app's stored document (and so inside a full-state backup) each routine is stored
under `data.routine`, keyed by its generated id (in a `.mcyc`, the routine *is* the root
object and there is no such map). The stored shape is described field by field in
[SCHEMA_2_6.md](SCHEMA_2_6.md#cycle-structure); the keys below are the ones a `.mcyc`
shares with it:

```json
{
  "id": "routine-1789760998636-bqphapbbc",
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
| `id` | string | **Yes** | The routine's generated id, which is also its key in `data.routine` (title keys were written until Nov 2026 and are repaired at boot; see SCHEMA_2_6.md). **Not part of a `.mcyc`:** the file carries `name` instead, and import always generates a fresh id |
| `title` | string | **Yes** | Display name |
| `tasks` | array | **Yes** | Array of task objects |
| `autoReset` | boolean | No | Auto-reset behavior. **Import default is `true`** — the importer reads it as `!== false`, so a file that omits this field becomes an *Auto* routine. Write `false` explicitly for Manual. |
| `deleteCheckedTasks` | boolean | No | To-Do mode behavior |
| `cycleCount` | number | No | Times completed |
| `createdAt` | number | No | Unix timestamp (milliseconds) |
| `taskOptionButtons` | object\|null | No | Per-cycle task button visibility settings |
| `recurringTemplates` | object | No | Recurring task templates |
| `reminders` | object\|null | No | Per-routine reminder configuration |
| `autoUncheckDaily` | object\|null | No | Auto-Uncheck Daily settings (`enabled`, `hour`, `minute`, plus two runtime fields) |
| `theme` | string | No | Vocabulary theme identifier (default: `"classic"`) |
| `history` | object | No | Per-routine activity log (v1.685+) |
| `clearedTasks` | object | No | Cleared tasks tracking (To-Do mode + cycle reset auto-removes) (v1.685+) |

### History Object (v1.685+)

Per-routine history tracking. Travels with **backup** exports (main-menu Download,
routine switcher download). On Share it's the **sender's choice** at share time (v2.345;
v2.342–v2.344 stripped it unconditionally — privacy: a shared routine usually
carries its structure, not the owner's event log). On import with "Import with
Progress", each event keeps only `type`, `timestamp` and `details`, and `details` is
reduced to an **allowlist** (v2.343; `HISTORY_DETAIL_NUMBER_KEYS`,
`HISTORY_DETAIL_STRING_KEYS` and `taskNames` in `cycleImportManager.js`); unknown
keys are dropped. "Use as Template" imports no history at all.

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

**Event Types** (the `type` is free text to the importer; these are the ones
`historyManager.logEvent()` has labels for):
- `cycle_completed` - Routine cycle completed
- `tasks_cleared` - Tasks cleared in To-Do mode
- `cycle_reset`, `achievement_unlocked`, `theme_changed`
- `task_added`, `task_deleted`, `task_edited`
- `task_priority_set`, `task_priority_removed`, `task_priority_color_changed`
- `recurring_tasks_removed`, `tasks_removed_on_reset`

### Cleared Tasks Object (v1.685+)

Per-routine tracking of cleared tasks (To-Do mode clears and tasks removed on a cycle
reset). Travels with **backup** exports (main-menu Download, routine switcher download). On Share it's the **sender's
choice** at share time (v2.345; v2.342–v2.344 stripped it unconditionally —
privacy: a shared routine usually shouldn't carry the owner's cleared task names).

```json
{
  "entries": [
    {
      "id": "clr-1704567890123-xyz98",
      "taskText": "Buy groceries",
      "clearedAt": 1704567890123,
      "priority": "high",
      "hadDueDate": false,
      "dueDate": null,
      "remindersEnabled": false,
      "autoClear": { "cycle": false, "todo": true },
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
| `priority` / `hadDueDate` / `dueDate` / `dueTime` / `remindersEnabled` / `autoClear` / `recurring` / `recurringSettings` / `clearedInMode` | various | Full metadata `_buildClearedEntry()` records, so **Recreate** rebuilds the task with settings intact. Since v2.342 the importer preserves all of these (validated) rather than dropping them |
| `totalCleared` | number | Lifetime count of cleared tasks (persists through prune) |
| `autoPruneEnabled` | boolean | Whether to auto-remove entries older than 90 days |

---

### Settings Object

Application-wide settings. These live in a **full-state backup only** — a `.mcyc` carries no
`settings` object. Their shape is part of the stored document and is described in
[SCHEMA_2_6.md](SCHEMA_2_6.md#settings); it is not repeated here.

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
| `useSpecificTime` | boolean | No | Whether the recurring panel's "specific time" option is on (default `false`). Written by the app's exports; not in the JSON example above. The importer sets it to `true` when a file gives a `time` without it |

**Old names still accepted on import.** From Aug to Nov 2026 the published schema and format page
(and the pinned `/schema/mcyc-2.5` and `-2.6` files, which never change) named some recurring fields
differently from the app: `repeatCount`, `daily.time` (`"HH:MM"`, 24-hour), `monthly.dayOfMonth`,
and `monthly.nthWeekday` + `monthly.weekday`. A file written with those imported without an error
and lost its repeat limit, daily time and monthly pattern. `acceptPublishedSchemaRecurring()`
(`recurring/recurringSettings.js`) now translates them before normalizing, only when the current
field is absent: `repeatCount` → `count`; `daily.time` → `time`; `dayOfMonth` → `useSpecificDays` +
`days`; `nthWeekday` (1–4, or 5 / -1 for the last) + `weekday` → `useWeekOfMonth` + `weekOfMonth`.
The rolling `/mcyc.schema.json` documents the current names and marks the old ones `deprecated`.

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

**Filename:** Morning_Routine.mcyc

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

**Filename:** Weekly_Workout.mcyc

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
      "priority": "high"
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
      "priority": "medium",
      "dueDate": "2025-02-15T12:00:00Z"
    }
  ],
  "autoReset": false,
  "cycleCount": 0,
  "deleteCheckedTasks": true
}
```

**Filename:** Product_Launch_Checklist.mcyc

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

**Filename:** Fluffy_Pancakes_Recipe.mcyc

---

## Import/Export

### Exporting from miniCycle

1. **Open the main menu** and expand **Routine Actions**
2. **Click "Download"** and confirm (or **Share**, which first asks whether to include history)
3. **The file is saved** under the routine's title with a `.mcyc` extension
4. **Location:** wherever you choose in the save dialog, or your browser's download folder

### Importing into miniCycle

Every path below ends in the same function, `processImportedData()`
(`modules/ui/cycleImportManager.js`). After the file passes its checks the app asks
how to import it:

- **Use as Template** — tasks come in unchecked, due dates are cleared, the cycle
  count starts at 0 and no history or cleared-task records are imported.
- **Import with Progress** — completion state, due dates, cycle count, history and
  cleared tasks are kept as the file has them.

The imported routine always gets a new generated id and becomes the open routine. A
title that is already in use is made unique.

**Method 1: Import Button**
1. **Open the main menu** and expand **Routine Actions** (the routine switcher and
   Browse Routines have an Import button too)
2. **Click "Import"**
3. **Select a `.mcyc` file**
4. **Choose** Use as Template or Import with Progress

**Method 2: Drag & Drop**
1. **Drag one `.mcyc` file** into the miniCycle window
2. **Choose** how to import it
3. **Cycle loads**

**Method 3: Open from Desktop (PWA)**
1. **Install miniCycle as a PWA** (Chromium browsers — Chrome, Edge, etc.)
2. **Double-click a `.mcyc` file** in your file explorer
3. **miniCycle opens** and starts the import
4. Requires the file-handlers entry in `manifest.json`

The first-run screen does not import a `.mcyc`. Its "Restore from a backup file"
button takes a full-state `.json` backup, and "Load a Sample" loads one of the bundled
sample routines.

> **Note:** This method only works when the app is installed as a PWA. The OS file association is registered via the [File Handling API](https://developer.chrome.com/docs/capabilities/web-apis/file-handling).

---

### Import Security

When importing `.mcyc` files, miniCycle applies several layers of validation and sanitization:

- **JSON validation:** Files that are not valid JSON are rejected with a clear error message
- **File size limit:** Maximum 10 MB per file
- **Task count limit:** Tasks beyond `LIMITS.TASKS_PER_CYCLE` (150) are truncated (not rejected), and the user is told how many were left out
- **Task ids:** An id is kept only if it is 1 to 64 characters of letters, digits, `.`, `_`, `:` or `-` and is not `__proto__`, `constructor` or `prototype`; otherwise a new one is generated
- **Text sanitization:** All task text and cycle names have control characters removed, are trimmed, and are cut to length limits at import (`LIMITS.TASK_CHARACTER` for task text, `LIMITS.CYCLE_NAME_CHARACTER` for the title). HTML is **not** stripped or escaped here — XSS safety lives at the render sinks (`textContent` for user data; `escapeHtml()` before any innerHTML interpolation), which escape imported text wherever it is displayed
- **Field allowlisting:** `taskOptionButtons` and `reminders` are sanitized to only allow known keys with expected types — unknown fields are stripped
- **Storage quota check:** Import is blocked if insufficient localStorage space is available
- **Recurring settings:** Every task's `recurringSettings` goes through `normalizeRecurringSettings()`, which drops unknown keys and coerces an unknown `frequency` to `"daily"`; `specificDates` entries must be real dates and are capped at `LIMITS.MAX_SPECIFIC_DATES`
- **Recurring template security:** A template is rebuilt for every task with `recurring: true`. From the file's own `recurringTemplates` entry for that task only the metadata fields `id`, `createdAt` and `updatedAt` are kept; all text comes from the sanitized task. A template in the file with **no** task of the same id (a routine exported between occurrences) is carried over too, with every field re-validated and its next occurrence recomputed
- **History and cleared tasks:** Event `details` are reduced to an allowlist and cleared entries are rebuilt field by field (see above)
- **Legacy `.tcyc` files** are refused

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
my file.mcyc              // Works, but needs quoting on a command line
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
// Missing id        // The importer generates one, so the id is not stable
```

**Rules:**
- Must be unique within the cycle
- String type (not number), 1 to 64 characters of letters, digits, `.`, `_`, `:` or `-`
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

**1. "Invalid file — not valid JSON." error**

**Cause:** Malformed JSON
**Fix:** Validate JSON syntax
```bash
python3 -m json.tool your_file.mcyc
```

---

**2. "Invalid file format" error**

**Cause:** The root object has no `name`, or `tasks` is not an array. (A full-state
`.json` backup fails here too — restore it from Settings instead.)
**Fix:** Ensure the root has both:
```json
{
  "name": "my_routine",
  "tasks": []
}
```

There is no "missing required fields" error for tasks: a task without an `id` or
`schemaVersion` is repaired, not rejected.

---

**3. Tasks don't appear after import**

**Cause:** Empty `tasks` array, or tasks that failed validation (an invalid task is
skipped, not reported). Tasks that arrive unchecked with no due date are expected
when you chose "Use as Template".
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
  "time": { "hour": 9, "minute": 0, "meridiem": "AM" }
}
```

`time` is an object (or `null`), not a string. Valid frequencies: `"hourly"`, `"daily"`,
`"weekly"`, `"biweekly"`, `"monthly"`, `"yearly"`; anything else is imported as `"daily"`.

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
      priority: options.priorities?.[index] || null   // "high" | "medium" | "low" | null
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
  priorities: [null, null, 'high', null, null, 'medium']
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

Versions the app's own state has passed through. This is what "Schema 2.6" (and, in
older passages, "Schema 2.5") refers to everywhere else in the docs, and it is *not*
stamped on a `.mcyc` file.

| Version | Date | Changes |
|---------|------|---------|
| **2.6** | Sep 19, 2026 (v2.573) | Routines keyed by a generated id under `data.routine`, `task.priority` as a level, one `task.autoClear` map; a 2.5 document is migrated once at boot and a pre-migration copy is kept |
| **2.5** | Jan 2025 | Priority flag + colour, `deleteWhenCompleteSettings` + derived mirror; superseded by 2.6 |
| **2.0** | Oct 2024 | Added recurring tasks, settings |
| **1.0** | 2023 | Initial schema |

A 2.5 document is migrated forward once at boot (`routine/schemaMigration26.js`, called from `AppState._migrateIfOlder`); pre-2.5 data predates the public launch and is not migrated.

### `.mcyc` file format

A `.mcyc` document carries **no format-version field**. Tasks inside it carry an integer
`schemaVersion` (currently `2`) — a third, separate line again. Readers should detect
capability by key presence, not by a version stamp.

| Schema document | Status |
|---|---|
| [`/mcyc.schema.json`](https://minicycle.app/mcyc.schema.json) | Rolling; tracks the current format. May gain fields. |
| [`/schema/mcyc-2.6.schema.json`](https://minicycle.app/schema/mcyc-2.6.schema.json) | Pinned to format 2.6 and **immutable**. Pin this for CI. |
| [`/schema/mcyc-2.5.schema.json`](https://minicycle.app/schema/mcyc-2.5.schema.json) | Pinned to format 2.5 and **immutable**; kept as published. |

**Backward compatibility:** existing files keep importing — see
[Compatibility commitment](#compatibility-commitment) at the top of this page.

---

## File Size Limits

**Recommended:**
- Tasks per cycle: < 100
- File size: < 1 MB

**Technical Limits:**
- Import file size: 10 MB (`MAX_FILE_SIZE_BYTES` in `cycleImportManager.js`); a larger file is refused
- Tasks per routine: `LIMITS.TASKS_PER_CYCLE` (150); the rest are truncated on import
- Storage: the import is blocked when the routine would not fit in the space left (localStorage is ~5-10 MB per origin)
- JSON nesting: Avoid deep nesting (< 5 levels)

---

## Security & Privacy

**Safe:**
- ✅ A `.mcyc` file contains one routine: its tasks and settings, plus its history and cleared-task records when those were included. No app settings, progress or other routines
- ✅ No personal information required
- ✅ No network requests
- ✅ Stored locally in browser

**Sharing:**
- ✅ Since v2.345, **Share asks the sender** what leaves the device: "Routine
  Only" (structure — tasks, settings, recurring templates) or "Include Full
  History" (also the event log + cleared-task records). Routine-only is listed
  first and is the fallback default. (v2.342–v2.344 stripped unconditionally;
  before v2.342 shares silently included everything)
- ⚠️ **Downloads are different**: both download paths keep history and cleared
  tasks (they exist for your own restore) — review before handing one to someone else
- ⚠️ Task text itself always travels — review content before sharing
- ⚠️ Use descriptive but generic names

---

## Resources

**Sample Files:**
- `examples/sample-routines/*.mcyc` - Sample routines (auto-discovered via `manifest.json`)
- See [Sample Routines Guide](../features/SAMPLE_ROUTINES.md) for adding new samples

**Documentation:**
- [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md) - App overview
- [QUICK_REFERENCE.md](../user-guides/QUICK_REFERENCE.md) - Feature guide
- [SCHEMA_2_6.md](SCHEMA_2_6.md) - The app's stored document
- [INDEX.md](../INDEX.md) - where to start in the docs

**Support:**
- GitHub: https://github.com/sparkinCreations/miniCycle
- In-app: Settings → Diagnostics & Testing

---

## Version

**Document Version:** 1.5
**Schema Version:** 2.6 (format 2.6 published September 19, 2026; 2.5 schema kept immutable at `/schema/mcyc-2.5.schema.json`)

---

> **Shipped September 19, 2026 (v2.573):** [SCHEMA_2_6_PLAN.md](../archive/SCHEMA_2_6_PLAN.md)
> renamed the per-task `deleteWhenCompleteSettings` to `autoClear`, dropped the derived
> `deleteWhenComplete` mirror and replaced `highPriority` + `priorityColor` with the `priority`
> level. That change altered this format, so it added `schema/mcyc-2.6.schema.json` and left the
> pinned 2.5 schema untouched. The exporter wrote both spellings from Sep 19 to Oct 13, 2026
> while older platform builds were still in use and writes only the 2.6 fields since; the
> importer reads both permanently. The `cycles` → `routine` rename in that
> same plan does **not** affect this format.

---

**Happy task cycling! 🎯**
