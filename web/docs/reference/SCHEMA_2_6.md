# miniCycle Schema 2.6 Documentation

**Version**: See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Last verified:** Nov 10 2026

Schema 2.6 (shipped with v2.573, Sep 19 2026): routines keyed by a generated id under `data.routine`, priority as a level, one `autoClear` map. Checked field by field against `createInitialSchemaData()`, `schemaMigration26.js` and the modules that write each field.

## Overview

Schema 2.6 represents the current data structure for miniCycle, consolidating all application state, user data, settings, and metadata into a single unified format. This schema supports multiple routines, recurring tasks, theme unlocks, and user progress tracking.

This page is the only description of the stored shape.
[DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md) is the short walkthrough of how a change
travels from a click to storage, with one worked example.

> **Source of truth is the code that writes the data:** `createInitialSchemaData()`
> (`modules/routine/migrationManager.js`) for a fresh install, `routineManager.js` for a
> new routine, `task/taskUtils.js` and `recurring/recurringTemplate.js` for tasks and
> templates, and `routine/schemaMigration26.js` for migrated 2.5 data. The JSDoc in
> `modules/core/types.js` is partly stale (its `Cycle` typedef still names `name` as the
> display field, and its recurring-settings, recurring-template and cleared-entry
> typedefs predate the shapes below), so check it against those writers.
>
> **Read stored names through the accessors**, not by spelling the keys:
> `modules/utils/cycleMode.js` (`getActiveRoutine()`, `getRoutine()`, `getAutoClear()`, …)
> and `modules/utils/priorityLevel.js` (`getPriorityLevel()`, `setPriorityLevel()`, …).

## Schema Version

**Current Version**: `2.6` (`SCHEMA.CURRENT`); the oldest version a build still reads is `SCHEMA.OLDEST_MIGRATABLE` = `2.5`

### Two Version Stamps (Document vs. Task)

miniCycle data carries **two separate version stamps**, and they are *intentionally
different values of different types*. They are not a mismatch — they count two
different things:

| Stamp | Where it lives | Current value | Type |
|-------|----------------|---------------|------|
| **Document version** | Top-level `schemaVersion` and `metadata.schemaVersion` | `"2.6"` | string |
| **Task version** | `schemaVersion` on each individual task | `2` | number |

Think of it as a **shipping container with individually-labeled boxes**:

- The **document version** is the label on the whole container — it describes how
  the entire data structure is organized (which sections exist, how cycles are
  stored, etc.).
- The **task version** is a label on each box inside — it describes the shape of a
  *single task*.

Why both exist: a task can travel on its own — exported, shared, copied, or
spawned from a recurring template — *apart from* the document it came from. Its own
version stamp lets any code understand a single task without needing the whole
document. The two also evolve on independent timelines: the document layout can
change without changing a task's shape, and vice versa, so each gets its own counter.

**Current behavior (as implemented today):**

- Every task is written with `schemaVersion: 2` (a number). New, imported, exported,
  and recurring tasks all receive `2`.
- No code compares a task's version to decide it is "outdated." The only task-version
  read (`routineLoader`) simply repairs a missing/invalid stamp back to `2`. So `2`
  is the current, correct task value — not a leftover from an older "Schema 2."
- The document version is never compared as a string. `utils/schemaVersion.js`
  parses it (`classifyStoredVersion` → current / older / newer / unknown;
  `isSupportedStoredVersion` for the restore and import gates) so `"2.10"` sorts
  after `"2.6"`. An **older** document is migrated at boot before it is adopted
  (`AppState._migrateIfOlder` → `routine/schemaMigration26.js`); a **newer** one is
  left untouched and the app shows a reload notice instead of first-run.
- Pre-2.5 data predates the public launch and is not migrated; the only migration
  is 2.5 → 2.6.

> **Note:** The two stamps differ in type (string `"2.6"` vs. number `2`). This is
> accepted as-is: task versions are never compared with `<`/`>`, and the document
> version goes through the parser above.

### What changed from 2.5 (migrated once at boot, Sep 2026)

| 2.5 | 2.6 | Why |
|-----|-----|-----|
| `data.cycles[<display name>]` | `data.routine[<generated id>]`; `title` is the name | routines keyed by a stable id (STATE_TRUTH_MIGRATION #20) and named with the product word |
| `appState.activeCycleId` | `appState.activeRoutineId` | same |
| `metadata.totalCyclesCreated` | `metadata.totalRoutinesCreated` | same |
| `task.highPriority` + `task.priorityColor` (a theme-tinted hex) | `task.priority`: `'high'` / `'medium'` / `'low'` / `null` | the colour is the active theme's swatch for the level; nothing is shown as stored |
| `settings.priorityColor` | `settings.defaultPriority` (a level) | same |
| `task.deleteWhenCompleteSettings` + a derived `deleteWhenComplete` mirror | `task.autoClear`: `{ cycle, todo, …any later mode }` — an OPEN map | one stored value, no reconciliation on load; a newer build's mode survives a round trip |
| cleared entry `wasHighPriority` / `priorityColor`; history detail `priorityColor` | `priority` on both | same rule, every container |

The migration (`migrateSchema_2_5_to_2_6`) keeps the raw 2.5 document under
`miniCycleData_pre-migration_<timestamp>` first, and persisted undo history is
cleared on that boot. Testing modal → Diagnostics → *Dry-Run 2.6 Migration* runs the
same function on a clone of the live state and reports what it would do.

**Keys are ids.** Every routine is stored under its own generated id (`id === key`); `title`
is only the name, and a rename changes only `title`. Creation, import, duplicate and rename
still wrote title keys until Nov 2026, so a 2.6 document can carry some. Boot re-keys them once
(`repairRoutineKeys` in `routine/schemaMigration26.js`, called by `AppState._repairRoutineKeys`):
a routine is filed under its existing `id` when that is usable, otherwise under a fresh one;
the raw document is kept first as above; the schema version does not change; persisted undo
history is cleared for the re-keyed routines only. The dry run reports what the repair would
do, and *Show Routine Keys* lists every routine's key, title and task count.

**No colour themes.** `settings.theme` could hold `golden-glow`, `dark-ocean` or `dark` until
Nov 2026, when those themes were retired. Boot retires one once (`retireLegacyColorTheme`, same
module, called by `AppState._retireLegacyTheme`; same backup, reported by the dry run): with no
colours of the user's own, the Golden or Ocean preset is written into `settings.customColors`
(with `preset`); with colours of their own, those are kept; `dark` turns on `darkMode`. Then
`settings.theme` is `"default"`. Nothing reads the field any more.

## Complete Schema Structure

```javascript
{
  schemaVersion: "2.6",

  metadata: {
    createdAt: 1696723400000,              // Unix timestamp
    lastModified: 1696723445123,           // Unix timestamp
    migratedFrom: "2.5",                   // Previous schema version (null when fresh)
    migrationDate: 1789760998636,          // Unix timestamp of the migration (null when fresh)
    totalRoutinesCreated: 5,               // Lifetime routine creation count
    totalCyclesCompleted: 0,               // Seeded as 0; no module updates it. The live
                                           // count is userProgress.cyclesCompleted
    schemaVersion: "2.6",                  // Duplicated here as well as at the root
    lastModifiedBy: "tab-x7f2",            // Writing tab's id — multi-tab conflict detection
                                           // (appState.js stamps it on every save; not seeded)
    storageQuota: { /* … */ }              // Cached quota estimate (storageUtils.js; not seeded)
    // NOT here: `appVersion`, `migrationHistory` and `totalTasksCompleted` were
    // documented on metadata but nothing writes them. `totalTasksCompleted` is
    // real and lives on `userProgress` — see that section.
  },

  settings: {
    theme: "default",                      // Always "default" (colour themes retired Nov 2026)
    darkMode: false,                       // Dark mode enabled
    alwaysShowRecurring: false,            // Always show recurring panel
    autoSave: true,                        // Auto-save enabled
    showThreeDots: false,                  // Global three dots menu visibility. A fresh install
                                           // seeds `true` on a touch-capable device
    // NOT here: `showTaskInput`. The task-input bar's visibility is stored per
    // routine (see `data.routine[id].showTaskInput` below); nothing reads a
    // settings-level value.
    onboardingCompleted: false,            // User completed onboarding
    dismissedEducationalTips: {},          // { [tipId]: boolean }
    defaultRecurringSettings: {            // Default values for new recurring tasks. Seeded with
      frequency: "daily",                  // these three keys; saving defaults from the recurring
      indefinitely: true,                  // panel stores the full Recurring Settings shape below
      time: null                           // Optional time-of-day
    },
    unlockedThemes: [],                    // Themes unlocked through milestones
    unlockedFeatures: [],                  // Features unlocked through milestones
    notificationPosition: { x: 0, y: 0 },  // Draggable notification position (seeded 0, 0)
    notificationPositionModified: false,   // User has customized position
    showCompletedDropdown: false,          // Enable completed tasks dropdown (written on first use)
    completedTasksExpanded: false,         // Completed section expanded state (written on first use)
    oneMenuSectionAtATime: true,           // Accordion for menu/settings/personalization (absent = true)
    // Accessibility is FLAT (not nested under an `accessibility` object):
    reducedMotion: false,                  // Reduce animations
    highContrast: false,                   // High contrast mode
    fontSize: "16",                        // Base font size (string)
    debugMode: false,                      // Debug mode enabled (written on first use)
    defaultPriority: "high",               // The level a newly flagged task starts at: the last
                                           // level picked (absent = "high"; priorityLevel.js)
    routineOpenView: "list",               // "list" | "browse" — what opening routines shows.
                                           // Seeded from the primary pointer; absent = "list"
    // …plus guided-tour step trackers (guidedTourStep, statsTourStep, …),
    // customColors {}, savedColorPresets [], taskViewLayout, and the three
    // collapsed-section maps (menuCollapsedSections, settingsCollapsedSections,
    // preferencesCollapsedSections — see the UI Preferences table below).
    // There is no single exhaustive list: createInitialSchemaData()
    // (routine/migrationManager.js) seeds the fresh-install keys, and each
    // feature adds its own key on first use. The Settings typedef in types.js
    // covers only part of them.
  },

  data: {
    routine: {
      "routine-1789760998636-bqphapbbc": { // Keyed by a GENERATED id (GlobalUtils.generateId('routine'))
        id: "routine-1789760998636-bqphapbbc",
        // ⚠️ `title` IS the display name. There is no `name` field: nothing in
        // the app writes one (routineManager creates routines with `title`).
        // `name` exists only in a .mcyc file, where it holds the exporting
        // device's storage key (see MCYC_FILE_FORMAT.md).
        title: "Morning Routine",          // Display name — the real field
        theme: "classic",                  // Per-routine vocab theme (default "classic")
        showTaskInput: true,               // Per-routine task-input bar visibility. OPTIONAL:
                                           // only `true` shows the bar, so absent = hidden
                                           // (modeManager toggles it per routine)
        cycleCount: 42,                    // Times completed
        autoReset: true,                   // Auto-cycle mode
        deleteCheckedTasks: false,         // To-Do mode (wins over autoReset)
        createdAt: 1696723400000,          // Creation timestamp
        lastModified: 1696723445123,       // OPTIONAL — absent until the user first switches
                                           // away from the routine (routineSwitcher);
                                           // previews fall back to createdAt
        lastAccessedAt: 1696723445123,     // OPTIONAL — set each time the routine is opened
                                           // from the switcher; drives the "recent" order
        tasks: [/* Task objects */],
        recurringTemplates: {/* Template objects, keyed by task id */},
        taskOptionButtons: {               // OPTIONAL — defaults: DEFAULT_TASK_OPTION_BUTTONS
                                           // (utils/globalUtils.js). Each value is the
                                           // VISIBILITY of one option button (a boolean)
          customize: true,                 // -/+ customize button
          moveArrows: false,               // Move task arrows
          highPriority: true,              // Priority button (an option-button id, not the
                                           // 2.5 task field of the same name)
          rename: true,                    // Rename/edit task
          delete: true,                    // Delete task
          recurring: false,                // Recurring task option
          dueDate: false,                  // Due date option
          reminders: false,                // Reminders option
          deleteWhenComplete: false        // 🧹 Clear on Reset / Marked for Clearing button
                                           // (an option-button id; the task field is `autoClear`)
          // NOT a default: `threeDots`. The three-dots menu is the global
          // `settings.showThreeDots`. The .mcyc importer still lets a
          // `threeDots` key through from a file; nothing reads it here.
        },
        // ⚠️ An OBJECT, not an array. OPTIONAL — created by the first logged
        // event. `historyManager.logEvent()` writes
        // { events: [], maxEvents: 100 } and unshifts onto `history.events`.
        // Building a fixture with `history: []` passes the `if (!cycle.history)`
        // guard (an empty array is truthy) and then throws on
        // `history.events.unshift`.
        history: { events: [], maxEvents: 100 },
        reminders: {},                     // OPTIONAL — a copy of the customReminders fields,
                                           // seeded by some creation paths and carried by
                                           // .mcyc files. The reminder system itself reads
                                           // the top-level `customReminders`
        autoUncheckDaily: {                // OPTIONAL — Auto-Uncheck Daily (task/dailyResetManager.js)
          enabled: false,
          hour: 0,                         // Local time of the daily uncheck
          minute: 0,
          lastResetDate: null,             // Local date of the last run
          pendingNotification: false       // A run happened while this routine was not open
        },
        clearedTasks: {                    // OPTIONAL — created by the first cleared task
                                           // (To-Do mode clears + cycle reset auto-removes)
          entries: [],                     // Array of cleared task records, newest first
          totalCleared: 0,                 // Total tasks cleared in this routine
          autoPruneEnabled: true           // Whether old entries are auto-pruned
        }
      }
    }
  },

  appState: {
    activeRoutineId: "routine-1789760998636-bqphapbbc", // Currently selected routine
    overdueTaskStates: {}                  // { [taskId]: boolean }
    // NOTE: the current mode is NOT stored here — it's derived from the active
    // cycle's autoReset / deleteCheckedTasks flags (getCycleMode in cycleMode.js).
  },

  ui: {                                    // ⚠️ OPTIONAL — created on demand, not seeded and not
                                           // part of the minimal valid shape
                                           // (validateStateStructure requires only a current
                                           // schemaVersion, data.routine and appState)
    moveArrowsVisible: false,              // Global arrow visibility
    activeTaskId: null                     // Task ID whose options are currently open
  },

  userProgress: {
    cyclesCompleted: 42,                   // Total cycles completed (global)
    rewardMilestones: [],                  // Reward ids already granted. LIVE: gamesManager and
                                           // statsPanelRewards push "task-order-game-100", and
                                           // Reset Progress clears it
    totalTasksCompleted: 156,              // Lifetime To-Do clears (Auto/Manual Cycle clears don't count) — LIVES HERE, not on metadata
                                           // (written by taskCycleReset and undo/redo; read by
                                           // achievementsManager, statsPanel, backupReminder)
    // createInitialSchemaData() seeds only `cyclesCompleted` and
    // `rewardMilestones`; `totalTasksCompleted` is written later, on first clear.
    // NOT here, despite older docs listing both:
    //  • `streaks` — never implemented, and types.js no longer declares a
    //    typedef for it. (The habit-tracker vocab theme once renamed "cycle" to
    //    "streak" in UI labels; that was wording, not state.)
    //  • `achievementsUnlocked` — superseded by the top-level `achievements`
    //    object below, which is what achievementsManager actually uses.
  },

  achievements: {                          // OPTIONAL — created by achievementsManager on first check
    unlocked: [                            // One RECORD per milestone reached (OR-based)
      { milestoneId: "milestone-5", unlockedAt: 1696723445123,
        unlockedVia: "cycles",             // "cycles" | "tasks" — which threshold was met
        valueAtUnlock: 5 }
    ],
    seen: {}                               // Created empty and cleared by Reset Progress;
                                           // nothing else writes or reads it
  },

  customReminders: {
    enabled: false,                        // Reminders enabled
    indefinite: false,                     // Remind forever
    dueDatesReminders: false,              // Remind about due dates
    repeatCount: 0,                        // Times to repeat
    frequencyValue: 30,                    // Interval value
    frequencyUnit: "minutes"               // "minutes"|"hours"|"days" (the keys of FREQUENCY_MS)
    // Defaults: DEFAULT_REMINDERS (core/constants.js). The reminders form also
    // saves `browserNotifications` and `privacyNoticeOpen`, and the scheduler
    // keeps `nextReminderTime`, `reminderStartTime` and `timesReminded` here.
    // NOT here: `customMessages`. Nothing reads one; the only write is the
    // .mcyc importer copying it into a routine's own `reminders` object.
  }
}
```

## Key Sections

### Metadata

Tracks application-level information and where the document came from:

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | number | Initial data creation timestamp |
| `lastModified` | number | Last update timestamp (stamped by every `AppState.update()`) |
| `schemaVersion` | string | The document version again (`"2.6"`), beside the root one |
| `migratedFrom` | string\|null | Previous schema version (`"2.5"` if migrated, `null` when fresh) |
| `migrationDate` | number\|null | Unix timestamp of the migration (`null` when fresh) |
| `totalRoutinesCreated` | number | Lifetime routine creation count (create, import, duplicate, sample) |
| `totalCyclesCompleted` | number | Seeded as `0` and kept by the migration; no module updates it |
| `lastModifiedBy` | string | Id of the tab that last saved (multi-tab conflict detection) |
| `storageQuota` | object | Cached storage-quota estimate (`utils/storageUtils.js`) |

Not on metadata: an app version, a migration history, or `totalTasksCompleted`
(that one is real and lives on `userProgress`).

### Settings

#### Theme & Display
| Field | Type | Description |
|-------|------|-------------|
| `theme` | string | Always `"default"`: the colour themes were retired in Nov 2026 (see above) |
| `darkMode` | boolean | Dark mode enabled/disabled |
| `unlockedThemes` | string[] | Themes unlocked through milestones |
| `unlockedFeatures` | string[] | Features unlocked through milestones |

#### Recurring Task Defaults
| Field | Type | Description |
|-------|------|-------------|
| `defaultRecurringSettings.frequency` | string | `hourly`, `daily`, `weekly`, `biweekly`, `monthly` or `yearly` |
| `defaultRecurringSettings.indefinitely` | boolean | Whether to repeat forever |

#### Notifications
| Field | Type | Description |
|-------|------|-------------|
| `notificationPosition` | {x, y} | User-draggable notification position |
| `notificationPositionModified` | boolean | Whether user has customized position |

#### UI Preferences
| Field | Type | Description |
|-------|------|-------------|
| `showCompletedDropdown` | boolean | Enable completed tasks dropdown |
| `completedTasksExpanded` | boolean | Completed section expanded state |
| `showThreeDots` | boolean | Global three dots menu visibility |
| `alwaysShowRecurring` | boolean | Always show recurring panel |
| `onboardingCompleted` | boolean | User completed onboarding |
| `dismissedEducationalTips` | object | Map of dismissed tip IDs |
| `debugMode` | boolean | Debug mode enabled |
| `oneMenuSectionAtATime` | boolean | Accordion behaviour for the main menu, settings modal and personalization modal — one section open at a time, each surface opening fully collapsed. **Absent reads as `true`.** When `false`, the three `*CollapsedSections` maps are applied on open instead |
| `menuCollapsedSections` | object | Main menu section name → collapsed. Written on every toggle in **both** modes; only read when `oneMenuSectionAtATime` is `false` |
| `settingsCollapsedSections` | object | Settings modal section name → collapsed. Same write-always / read-conditionally rule |
| `preferencesCollapsedSections` | object | Personalization modal section name → collapsed. Same rule; includes `live-preview`, which is never part of the accordion |

#### Accessibility (flat settings fields — **not** nested under an `accessibility` object)
| Field | Type | Description |
|-------|------|-------------|
| `reducedMotion` | boolean | Reduce animations |
| `highContrast` | boolean | High contrast mode |
| `fontSize` | string | Base font size (e.g. `"16"`) |

#### Collapsible-section State
| Field | Type | Description |
|-------|------|-------------|
| `menuCollapsedSections` | object | Per-section collapse state for the main menu |
| `settingsCollapsedSections` | object | Per-section collapse state for Settings |

### Data

#### Cycle Structure

Each cycle contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | The routine's generated id; equal to its key in `data.routine` |
| `title` | string | **Display name — the real field.** There is no `name` field; nothing writes one |
| `theme` | string | Per-routine vocab theme (`"classic"` by default) |
| `showTaskInput` | boolean | Per-routine task-input bar visibility. Optional; only `true` shows the bar |
| `tasks` | Task[] | Array of task objects |
| `recurringTemplates` | object | Recurring templates, keyed by task id (see below) |
| `autoReset` | boolean | Auto-reset on completion (Auto Cycle Mode) |
| `deleteCheckedTasks` | boolean | Delete tasks when checked (To-Do Mode); wins over `autoReset` |
| `cycleCount` | number | Number of times cycle has been completed |
| `createdAt` | number | Creation timestamp |
| `lastModified` | number | Optional. Set when the user switches away from the routine |
| `lastAccessedAt` | number | Optional. Set when the routine is opened from the switcher |
| `taskOptionButtons` | object | Optional. Per-cycle button visibility settings |
| `history` | **object** | Optional. Per-routine activity log — `{ events: [], maxEvents: 100 }`, NOT an array |
| `reminders` | object | Optional. A copy of the reminder fields written by some creation paths and by import; the reminder system reads the top-level `customReminders` |
| `autoUncheckDaily` | object | Optional. Auto-Uncheck Daily: `{ enabled, hour, minute, lastResetDate, pendingNotification }` |
| `clearedTasks` | object | Optional. Cleared tasks tracking (To-Do mode + cycle reset auto-removes) |
| `clearedTasks.entries` | array | Array of cleared task records |
| `clearedTasks.totalCleared` | number | Total tasks cleared in this routine |
| `clearedTasks.autoPruneEnabled` | boolean | Whether old entries are automatically pruned |

#### History Entry Structure

`cycle.history` is an **object**, and the entries live in `history.events` — newest
first (`unshift`), capped at `maxEvents` (100). `historyManager.logEvent()` is the
only writer of new events (a `.mcyc` import can bring a whole `history` object
with it; a duplicated routine starts without one):

```javascript
cycle.history = {
  events: [ /* newest first */ ],
  maxEvents: 100
}
```

Each entry in `history.events`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `evt-<timestamp>-<random>` |
| `type` | string | Entry type (e.g., "cycle_completed", "tasks_cleared", "task_added") |
| `timestamp` | number | Unix timestamp of action |
| `details` | object | Type-specific payload — per-event fields such as `taskText` live in HERE, not on the entry |

> **Fixture warning.** `history: []` is the shape an earlier revision of this doc
> described, and it fails in a way that is easy to misread: the empty array passes
> `if (!cycle.history)` (arrays are truthy), so the guard does not repair it, and the
> next write throws on `history.events.unshift`. Seed `{ events: [], maxEvents: 100 }`
> or omit the key entirely and let `logEvent` create it.

#### Cleared Task Record Structure

Each entry in `clearedTasks.entries`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique id for the cleared entry (e.g. `clr-...`) |
| `taskText` | string | Text of the cleared task |
| `clearedAt` | number | Unix timestamp when cleared |
| `priority` | string\|null | The task's priority level when cleared (`'high'` / `'medium'` / `'low'` / `null`) |
| `hadDueDate` | boolean | Whether the task had a due date |
| `dueDate` | string\|null | The task's due date, if any |
| `dueTime` | string\|null | The task's due time (`"HH:MM"`), only beside a `dueDate` |
| `remindersEnabled` | boolean | Whether task reminders were enabled |
| `autoClear` | object | Per-mode clear map snapshot (`{ cycle, todo }`) |
| `recurring` | boolean | Whether the task was recurring |
| `recurringSettings` | object\|null | A copy of the task's recurring settings, so Recreate can restore them |
| `clearedInMode` | string | `'todo'` or `'cycle'`: the mode the task was cleared in |

The entry shape has one builder, `ClearedTasksManager._buildClearedEntry()`
(`features/clearedTasksManager.js`).

#### Task Option Buttons

Each value is a boolean: whether that option button is shown on a task row. The
keys are option-button ids, which is why two of them keep 2.5 spellings
(`highPriority`, `deleteWhenComplete`) although the task fields they act on are
`priority` and `autoClear`. Defaults: `DEFAULT_TASK_OPTION_BUTTONS`
(`utils/globalUtils.js`).

| Field | Description |
|-------|-------------|
| `customize` | -/+ customize button (always true) |
| `moveArrows` | Move task arrows |
| `highPriority` | Priority button |
| `rename` | Rename/edit task |
| `delete` | Delete task |
| `recurring` | Recurring task option |
| `dueDate` | Due date option |
| `reminders` | Reminders option |
| `deleteWhenComplete` | 🧹 Clear on Reset (cycle) / Marked for Clearing (to-do) |

#### Task Object Structure

Each task object in the `tasks` array:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `text` | string | Task description text |
| `completed` | boolean | Completion status |
| `priority` | string\|null | Priority LEVEL: `'high'` / `'medium'` / `'low'` / `null`. No colour is stored — the row shows the active theme's swatch for the level (`vocabThemeManager.getTaskPriorityColor`) |
| `dueDate` | string\|null | Due date in ISO format |
| `dueTime` | string\|null | Due time `"HH:MM"` (24-hour, local), only beside a `dueDate`; absent in data written before Oct 2026 |
| `remindersEnabled` | boolean | Task-specific reminder toggle |
| `recurring` | boolean | Whether task is recurring |
| `recurringSettings` | object | Recurring task configuration (`{}` when not recurring) |
| `schemaVersion` | number | Per-task shape version. Currently the number `2` (`SCHEMA.CURRENT_TASK`). This is a *separate* counter from the document's `schemaVersion` (`"2.6"`) — see "Two Version Stamps" above. |
| `autoClear` | object | 🧹 Clear on Reset (cycle) / Marked for Clearing (to-do), per mode: `{ cycle: boolean, todo: boolean }`. An OPEN map — a boolean under any other key is kept. Read with `getAutoClear(task, routine, defaults)`; there is no derived mirror. A **recurring** task's pin is one choice for every mode (Oct 2026): `setAutoClear` writes every key, a map pinned in any mode reads pinned in all, and `syncTaskAutoClear` repairs a disagreeing one to all-`false` |

Task creation (`TaskUtils.createOrUpdateTaskData()` in `task/taskUtils.js`) writes
exactly the fields above. It does not write `createdAt` or `completedAt`; no module
does, although the `Task` typedef in `types.js` still lists them.

A task as stored:

```javascript
{
  id: "task-xyz789",
  text: "☕ Make coffee",
  completed: false,
  priority: null,                  // 'high'|'medium'|'low'|null — a level, no colour stored
  dueDate: null,                   // ISO string or null
  dueTime: null,                   // "HH:MM" or null, only beside a dueDate
  remindersEnabled: false,
  recurring: false,
  recurringSettings: {},
  autoClear: { cycle: false, todo: true }, // defaults: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
  schemaVersion: 2                 // per-task shape version (number)
}
```

#### Recurring Template Structure

`recurringTemplates` is keyed by the id of the task each template spawns. Every
writer builds the record through `buildRecurringTemplate()`
(`recurring/recurringTemplate.js`), so this is the whole shape:

```javascript
recurringTemplates: {
  "task-def456": {
    id: "task-def456",               // The task id; an instance in `tasks` shares it
    text: "💊 Take medication",
    recurring: true,
    recurringSettings: { /* see Recurring Settings Structure */ },
    dueDate: null,
    dueTime: null,                   // only kept beside a dueDate
    priority: "high",                // 'high'|'medium'|'low'|null
    remindersEnabled: true,
    autoClear: { cycle: true, todo: true }, // defaults: DEFAULT_RECURRING_DELETE_SETTINGS
    occurrenceCount: 0,
    lastTriggeredTimestamp: null,
    paused: false,                   // a paused template keeps its schedule but never spawns
    nextScheduledOccurrence: 1696809600000, // epoch ms; null = never fires again
    position: null,                  // index where a recreated instance is inserted; null appends
    schemaVersion: 2                 // RECURRING_TEMPLATE_SCHEMA_VERSION
  }
}
```

#### Recurring Settings Structure

The full shape is what `normalizeRecurringSettings()` (`recurring/recurringSettings.js`)
returns; [RECURRING_SYSTEM_REFERENCE.md](RECURRING_SYSTEM_REFERENCE.md) explains how
each block is scheduled.

```javascript
{
  frequency: "daily",              // "hourly"|"daily"|"weekly"|"biweekly"|"monthly"|"yearly"
                                   // (anything else is coerced to "daily")
  indefinitely: true,              // Repeat forever
  count: null,                     // Number of occurrences when not indefinite
  untilDate: null,                 // End date when not indefinite
  time: null,                      // { hour, minute, meridiem, military } or null
  useSpecificTime: false,
  specificDates: { enabled: false, dates: [] },
  hourly: { useSpecificMinute: false, minute: 0 },
  weekly: { days: [] },            // "Sun" … "Sat"
  biweekly: { week1: [], week2: [], referenceDate: null },
  monthly: {
    useSpecificDays: false,
    days: [],                      // 1-31
    lastDay: false,
    useWeekOfMonth: false,
    weekOfMonth: null              // { ordinal: "1"|"2"|"3"|"4"|"last", day: "Mon" } or null
  },
  yearly: {
    months: [],                    // 1-12
    useSpecificDays: false,
    applyDaysToAll: true,
    daysByMonth: {}                // { all: [days] } or { "1".."12": [days] }
  }
}
```

There is no `daily` block. When a frequency needs a selection and none was made,
the normalizer fills in today's weekday, day of month or month, and a missing
`biweekly.referenceDate` becomes the current time.

### App State

Tracks current application state:

| Field | Type | Description |
|-------|------|-------------|
| `activeRoutineId` | string\|null | Key (generated id) of the currently open routine |
| `overdueTaskStates` | object | Map of task ID to overdue boolean |

> The current **mode** is not stored in `appState` — it's derived from the active cycle's `autoReset` / `deleteCheckedTasks` flags (`getCycleMode()` in `utils/cycleMode.js`).

### UI State

Global UI configuration. The whole `ui` object is optional: it is created on
demand, not seeded.

| Field | Type | Description |
|-------|------|-------------|
| `moveArrowsVisible` | boolean | Global arrow visibility |
| `activeTaskId` | string\|null | Task ID whose options panel is currently open |

### User Progress

Gamification and achievement tracking:

| Field | Type | Description |
|-------|------|-------------|
| `cyclesCompleted` | number | Total cycles completed (global across all routines) |
| `rewardMilestones` | string[] | Reward ids already granted (e.g., "task-order-game-100") |
| `totalTasksCompleted` | number | Lifetime To-Do clears; absent until the first one. Auto/Manual Cycle clears don't count (`clearsCountTowardAchievements()` in `utils/cycleMode.js`) |

> Fresh state seeds only `cyclesCompleted` + `rewardMilestones`. `streaks` and an unlocked-achievements list on `userProgress` are **not** fields the code writes — see the notes in the structure above.

### Achievements

OR-based achievement system (unlock via cycles OR tasks):

| Field | Type | Description |
|-------|------|-------------|
| `unlocked` | object[] | One record per milestone reached: `{ milestoneId, unlockedAt, unlockedVia, valueAtUnlock }` |
| `seen` | object | Created as `{}` and reset by Reset Progress; nothing else writes or reads it |

**`achievements.unlocked` and `settings.unlockedThemes` are deliberately separate.**
They look like the same idea — "things the user has earned" — and they are not:

- `achievements.unlocked` is a permanent RECORD of milestones reached. Nothing
  consumes it to gate functionality; it drives badges and the achievements modal.
- `settings.unlockedThemes` is an ENTITLEMENT list the theme system reads to decide
  what the user may actually apply, and it is written by other paths too (import
  reads it to decide whether a routine's theme survives — see
  `notify.themeLockedOnImport`).

Merging them would make a cosmetic badge record load-bearing for theme access, and
would mean an import touching theme entitlements could rewrite the user's milestone
history. Keep them apart.

**Achievement tiers** are defined once, in `MILESTONES.TIERS` (`core/constants.js`).
Each tier unlocks at its cycle threshold OR its task threshold, whichever comes first:

| `milestoneId` | Name | Cycles | Tasks |
|---------------|------|--------|-------|
| `milestone-5` | Habit Tracker | 5 | 5 |
| `milestone-25` | Fitness | 25 | 125 |
| `milestone-50` | Scholar | 50 | 250 |
| `milestone-75` | Cleaning | 75 | 375 |
| `milestone-100` | Crowned | 100 | 500 |

### Custom Reminders

User-configurable reminder system:

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Reminders on/off |
| `indefinite` | boolean | Repeat reminders forever |
| `dueDatesReminders` | boolean | Remind about task due dates: in-app banners on open (overdue) and on setting a date within three days; with `browserNotifications` also one system notification per due day at `LIMITS.DUE_DATE_NOTIFY_HOUR` (dueDates.js `syncDueDateNotifications`) |
| `repeatCount` | number | Number of times to repeat |
| `frequencyValue` | number | Numeric interval value |
| `frequencyUnit` | string | "minutes"\|"hours"\|"days" |
| `browserNotifications` | boolean | Also send system notifications (saved by the reminders form; not in the defaults) |

The reminders form also saves `privacyNoticeOpen`, and the scheduler keeps
`nextReminderTime`, `reminderStartTime` and `timesReminded` on this object. Defaults
are `DEFAULT_REMINDERS` (`core/constants.js`), which readers substitute when
`customReminders` is absent.

## Undo Snapshots — new state surfaces must join the signature

`buildSnapshotSignature()` (`ui/undoSnapshotUtils.js`, re-exported by `undoRedoManager`) reduces a snapshot to a comparison key
and **skips pushing** anything whose key matches the previous entry. That dedup is
what stops a burst of no-op updates flooding the undo stack.

The consequence is a rule worth knowing before adding to the schema:

> **Any new user-editable state surface must be added to `buildSnapshotSignature()`,
> or a change touching ONLY that surface will dedup against the previous snapshot
> and never enter undo history.**

It fails silently and looks like "undo just doesn't cover that" rather than a bug.
It has bitten twice already, and both fixes are visible in the function today:

- **Settings objects, not just their booleans.** `recurringSettings` and
  `autoClear` are serialised whole; comparing only a derived `recurring` flag
  meant editing a schedule without toggling the flag was invisible.
- **`taskViewLayout.positions`.** A drag-end or dock-back changes nothing else, so
  without `tvl` in the key the whole Task View layout feature sat outside undo.

The same applies to anything added under `settings`, `data.routine[id]`, or a task
record. If it is user-editable and worth undoing, it belongs in the signature.

## Migration Support

A migrated document records where it came from:

```javascript
metadata: {
  migratedFrom: "2.5",
  migrationDate: 1789760998636
}
```

The migration is pure and separately tested (`tests/schemaMigration26.tests.js`); the
boot seam that runs it, keeps the pre-migration copy and clears undo history is pinned
by the *a 2.5 document is migrated at boot* journey.

**The copy is the user's, not just a debugging aid (Sep 21, 2026).** While a
`miniCycleData_pre-migration_<ts>` key exists, Settings → Data Management shows a
block naming its date with three actions (`backupRestoreManager`):
*Download the copy* writes it as an ordinary backup file (the raw bytes inside a
`{ schemaVersion, miniCycleData, backupMetadata }` wrapper, so Restore All Routines
reads it); *Restore the copy* takes a confirmation and a safety backup, clears undo
history (its snapshots are of the state being replaced), writes the raw document
back and re-renders in place — the reload migrates it again with the *current*
build's migration, which is the point when the original one went wrong, and keeps a
fresh copy of the same bytes; *Delete the copy* removes it. Pinned by the *the
pre-migration copy is usable from Settings* journey. The same change made
`validateStatePayloadString` admit the 2.5 layout: from v2.573 to v2.574 the
Settings restore had rejected every backup file made before 2.6 as corrupt while the
version check beside it admitted 2.5 (*a backup made before 2.6 restores from
Settings* journey). Every restore entry point now clears undo history before writing
(Settings file restore, the testing modal's IndexedDB restore, the pre-migration
restore): undo snapshots are per routine and hold only that routine's tasks, so after a
whole-document restore an Undo would drop one routine's old tasks over restored
settings, progress and routines — a half-revert. The safety backup taken first is the
coherent way back.

## Usage Example

```javascript
// Loading data (via DI - AppState is injected, not accessed via window.*)
import { getActiveRoutine } from '../utils/cycleMode.js';
const state = this.deps.AppState.get();
const routine = getActiveRoutine(state);   // never spell data.routine[...] in a module
const isDarkMode = state.settings.darkMode;

// Updating data
this.deps.AppState.update(state => {
  state.settings.darkMode = true;
}, true); // true = save immediately
```

## File Format Compatibility

A `.mcyc` file holds **one routine**, not this whole document: a flat object with the
routine's fields (`title`, `tasks`, `recurringTemplates`, `taskOptionButtons`, …) built
by `buildMcycPayload()` (`utils/mcycPayload.js`). Tasks and templates inside it use
the shapes above. Settings, progress and achievements never travel in a `.mcyc`; a
full backup file does carry the whole document. See
[MCYC_FILE_FORMAT.md](./MCYC_FILE_FORMAT.md).

## Related Documentation

- [MCYC_FILE_FORMAT.md](./MCYC_FILE_FORMAT.md) - File import/export format
- [DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md) - How a change reaches storage, with a worked example
- [types.js](../../modules/core/types.js) - JSDoc type definitions (partly stale; see the note at the top)
- [RECURRING_SYSTEM_REFERENCE.md](RECURRING_SYSTEM_REFERENCE.md) - Recurring task implementation
- [SCHEMA_2_6_PLAN.md](../archive/SCHEMA_2_6_PLAN.md) - The plan this schema shipped from: decisions, the
  reader sweeps, the migration's ordered steps and the release checklist.
