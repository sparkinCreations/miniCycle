# Schema 2.6 Plan

**Status:** Planned — **rewritten Aug 2026 against v2.517 by measurement.** The previous
version of this document described a data shape this codebase has never had (see
[What was wrong before](#what-was-wrong-before)); every structure, path and count below was
verified against the running code, and the claims that could not be verified are marked.
**Priority:** Medium — but see [Two renames, not one](#two-renames-not-one): the two halves
have very different value, and the cheaper half is the more useful one. A third change,
**Priority levels** (below), was decided in September 2026. **All three ship as one migration and
one version bump, bundled with the UUID re-key from `STATE_TRUTH_MIGRATION.md` #20** (decided
Sep 2026 — see *Ordering*).
**Breaking changes:** Yes (stored data + the published `.mcyc` schema).
**Last Updated:** September 2026 (decisions: `autoClear` confirmed, priority becomes a level;
transitional helpers added; priority folded into every section below). Previously August 2026:
full rewrite — corrected schema shape, migration seam, `.mcyc` obligations, surface inventory,
harness-correct tests, plan ordering.

---

## What 2.5 actually looks like

Measured from `createInitialSchema25Data()` in `modules/routine/migrationManager.js:100`.
The stored document is **flat**. There is no `miniCycle` wrapper key:

```javascript
{
  schemaVersion: "2.5",
  metadata:     { createdAt, lastModified, migratedFrom, migrationDate,
                  totalCyclesCreated, totalCyclesCompleted, schemaVersion,
                  lastModifiedBy, storageQuota },
  settings:     { theme, darkMode, alwaysShowRecurring, autoSave, showThreeDots,
                  onboardingCompleted, /* …tour steps, priorityColor, quickActions… */ },
  data:         { cycles: { [cycleId]: Cycle } },
  appState:     { activeCycleId },
  userProgress: { … },
  customReminders: { … }
}
```

`docs/reference/SCHEMA_2_5.md` is accurate and is the reference for field-level detail —
prefer it over anything restated here.

**Two different `schemaVersion` fields exist.** The document-level one is the string
`"2.5"`. Tasks carry their own **integer** `task.schemaVersion` (default `2`), repaired in
`routineLoader.js:305`. They version different things and move independently. Nothing in
this plan changes the per-task integer.

---

## Two renames, not one

The original doc treated 2.6 as a single terminology fix. Measurement says it is two
independent changes with very different payoffs, and they should be judged separately.

|                          | **A · `deleteWhenComplete*` → `autoClear`** | **B · `cycles` → `routine`** |
|--------------------------|---------------------------------------------|------------------------------|
| Scope                    | moderate — measure when work starts         | the widest of the changes — measure when work starts |
| What it fixes            | a live collision with a different feature   | terminology drift            |
| Aligns with              | the existing `clearedTasks` schema noun     | nothing already in the schema |
| UI vocabulary today      | already says "clear"                        | already says "routine"       |
| `.mcyc` format impact    | **yes** — published schema changes          | **none** — 0 references      |
| Recommendation           | **do this one**                             | bundled into the single 2.6 migration (decided Sep 2026) |

**A third, independent change was added in September 2026:** priority stored as a level instead
of a colour — see **Priority levels** below. Like Rename A it changes the published `.mcyc`
format, so the two should ship together as one format bump.

### Rename A — `deleteWhenComplete*` → `autoClear`

**Why the current name is wrong, not merely inelegant.** `delete` already means something
else to users: `action.deleteTask` is *"Delete Task"* / *"Are you sure you want to delete
'{name}'?"* — explicit, user-initiated destruction. The field named `deleteWhenComplete`
describes something the product deliberately calls **clearing**, and the UI never once
calls it deletion (`taskButtons.js:285`):

```javascript
labelKey = isToDoMode ? 'taskOption.markedForClearing' : 'taskOption.clearOnReset';
```

| mode   | label shown          | description shown                                  |
|--------|----------------------|----------------------------------------------------|
| cycle  | "Clear on Reset"     | *removes task when cycle resets*                   |
| to-do  | "Marked for Clearing"| *removes task when completed tasks are cleared*     |

And the schema already owns the noun: `clearedTasks { entries, totalCleared,
autoPruneEnabled }`, documented as *"To-Do mode clears + cycle reset auto-removes"*, with
its own `clearedTasksManager`. **`taskCycleReset.js:385` records `deleteWhenComplete` tasks
into `clearedTasks`** — the field feeding `clearedTasks` is the one named "delete."

**Decision (Sep 2026): the name is `autoClear` — confirmed by the product owner.** In the
meantime the rule in the repo-root `CLAUDE.md` (§Naming) applies: no new names built on
"delete" for this option; say "Clear on Reset" / "Marked for Clearing", and read or write it
through `getAutoClear()` / `setAutoClear()` — see
[Transitional naming helpers](#transitional-naming-helpers-sep-2026).

**Why `autoClear` and not `clearOnReset` / `clearOnComplete`.** The *trigger* differs by
mode — reset in cycle mode, clearing in to-do mode — which is exactly why the stored value
is a per-mode map. Naming the trigger reintroduces the mismatch in a new word.
`autoClear.cycle` and `autoClear.todo` read correctly in both.

**Shape.** Collapse the pair into one field while renaming — see
[the reconciler](#the-reconciler-you-must-not-break) for why the second field exists and why
removing it is the point:

```javascript
// 2.5                                        // 2.6
task.deleteWhenCompleteSettings = {…}   →     task.autoClear = { cycle: false, todo: true }
task.deleteWhenComplete = false         →     (removed — derived at read time)
```

### Rename B — `cycles` → `routine`

```javascript
data.cycles[cycleId]          →  data.routine[routineId]
appState.activeCycleId        →  appState.activeRoutineId
metadata.totalCyclesCreated   →  metadata.totalRoutinesCreated
```

**Keep** `cycleCount`, `userProgress.cyclesCompleted`, and the user-facing "Complete Cycle"
wording — those refer to completions, which really are cycles.

It fixes no defect, but codebase coherence is a goal in itself here, so it is not optional.
**Decided Sep 2026: it ships inside the single 2.6 migration**, alongside Rename A, priority
storage and the UUID re-key (`STATE_TRUTH_MIGRATION.md` #20). The re-key rewrites the routines
map anyway, so renaming it in the same pass costs little, and users' data is migrated once
instead of twice.

### Transitional naming helpers (Sep 2026)

Until either rename happens, new code does not have to spell the stored names.
`modules/utils/cycleMode.js` exports helpers that use the product vocabulary while reading
and writing the **current 2.5 keys**. They add no keys to stored data, so saved data,
backups and `.mcyc` files are unchanged.

| Helper | Reads / writes today (2.5) | After 2.6 |
|---|---|---|
| `getRoutines(state)` | `data.cycles` | `data.routine` |
| `getRoutine(state, id)` / `getActiveRoutine(state)` | `data.cycles[id]` | `data.routine[id]` |
| `getActiveRoutineId(state)` / `setActiveRoutineId(state, id)` | `appState.activeCycleId` | `appState.activeRoutineId` |
| `getAutoClear(task, routine, defaults)` / `setAutoClear(task, routine, value, defaults)` | `deleteWhenCompleteSettings[mode]` + the `deleteWhenComplete` mirror | `autoClear[mode]` |
| `getAutoClearMode` / `resolveAutoClear` / `syncTaskAutoClear` | the same functions as `getDeleteSettingsMode` / `resolveDeleteWhenComplete` / `syncTaskDeleteWhenComplete` | renamed or retired with the reconciler |

`cycleCount` and `userProgress.cyclesCompleted` get no helper and keep their names — they
count completions, which really are cycles.

**What this changes for the plan.** When a rename lands, these helpers' internals change in
the same commit, and every caller already using them needs no edit. It does **not** shrink
the existing surface: code written before the helpers still reads the stored keys directly,
so the sweep scope above still applies. Each call site moved onto a helper beforehand is one
fewer to touch during the migration.

**Why helpers, not aliases on the data.** Measured Sep 2026: an alias getter hidden on the
state object is dropped by `structuredClone` (every `AppState.update`, undo snapshots); a
visible one makes JSON store every routine twice, which become two diverging copies after a
reload; and wrapping state in a Proxy makes `structuredClone` throw. Do not revisit that.

---

## Priority levels — store a level, not a colour

**Decision (Sep 2026): priority becomes a level — `high` / `medium` / `low` — confirmed by the
product owner.** The picker's Red / Yellow / Green already read as levels; today the app treats
them as one on/off flag with a colour attached. This is a third, independent change: it touches
the published `.mcyc` schema like Rename A, and can ship with either rename or on its own.

### What 2.5 does (measured Sep 2026)

- A task stores `highPriority` (boolean) and `priorityColor` (hex). `mcyc-2.5.schema.json` says
  the colour is *"ignored unless highPriority is true"*, and accepts **any** hex.
- The picker (`showPriorityColorPickerNotification` in `notifications.js`) offers the active
  theme's `priorityColors`, or `DEFAULT_PRIORITY_SWATCHES` for classic. Swatches are darkened
  per theme for contrast, so **the stored hex is theme-specific** (habit-tracker's red is
  `#8b1a1a`, fitness's is `#c0392b`).
- Toggling priority on saves the resolved colour into the task and its recurring template
  (`taskCRUD.js`). Picking a swatch also writes `settings.priorityColor`, so the last pick
  becomes the colour for the next task flagged.
- No UI accepts a free-form priority colour. Non-swatch hexes only arrive through `.mcyc`
  files written by hand.
- Search's Priority filter and "Priority First" sort only see on/off, and they read a DOM
  class, not state.

### What is wrong with it

1. **A stored hex does not follow the theme.** Picked under one theme, a task keeps that
   theme's tint after a switch, and ships it as-is in shared `.mcyc` files.
2. **Colour is the only signal.** Assistive tech hears on/off (`aria-pressed`), never the level.
3. **Three display fallbacks disagree.** The toggle uses task → `settings.priorityColor` →
   `COLORS.PRIORITY_DEFAULT`; `taskDOM` / `taskDOMPatch` re-renders use task → default;
   `focusTaskPanel` uses task → `var(--color-red)`. Harmless while the toggle saves a colour,
   but a flagged task that arrives with none renders differently per surface.
4. **Theme presets carry a conflicting colour.** Each theme's `colorPreset.priorityColor`
   (fitness: `#1e8c52`, a green) sets the root `--task-priority-color` CSS variable
   (`themeManager.js`). Flagged tasks write an inline value that overrides it, so it rarely
   shows — but under levels, a green "High" default contradicts green = low. **Decided and done
   Sep 2026: each theme's `colorPreset.priorityColor` is its High swatch**, guarded by a test in
   `themes.tests.js`. No schema change was needed.

### 2.6 shape

```javascript
// 2.5                                        // 2.6
task.highPriority = true               →      task.priority = 'medium'   // 'high' | 'medium' | 'low' | null
task.priorityColor = '#b8860b'         →      (removed — colour derived from the theme at render)
settings.priorityColor = '#b8860b'     →      settings.defaultPriority = 'medium'
```

- **Migration and import:** `highPriority: false` → `null`. Flagged with a known swatch hex (any
  theme, or the defaults) → that swatch's level. Flagged with no hex → `'high'`. Flagged with an
  **unknown** hex → the level of its **colour family** (rule below). No colour is stored in 2.6;
  every task's colour comes from the theme.
- **Custom colours map to their colour family (decided Sep 2026).** No UI ever produced a
  non-swatch colour, but a hand-written `.mcyc` can carry one. It keeps the author's rough intent
  as a level instead of a field. **Match by hue, not by nearest swatch:** a plain nearest-colour
  match (CIELAB ΔE) was measured and rejected — habit-tracker's swatches are darkened for
  contrast, so lightness decided the match (navy → High via dark red; gray, black and white →
  Low). The rule:
  1. an exact swatch match (any theme, or the defaults) wins
  2. no clear colour — HSL saturation below 0.25, or lightness below 0.10 or above 0.92 → `'high'`
  3. otherwise take the nearest hue anchor — red 0° → `'high'`, yellow 50° → `'medium'`, green
     125° → `'low'` — if it is within **45°**
  4. anything farther from every anchor (blues, purples) → `'high'`, which is what on/off
     priority has always meant

  These numbers are tuning values: they live in `core/constants.js`, not inline in the code.

  Measured outcomes: pink `#ff69b4` and maroon `#800000` → High; orange `#ff8c00`, gold
  `#daa520`, olive `#808000` and lime `#9acd32` → Medium; teal `#1abc9c` → Low; blue `#3498db`,
  purple `#8e44ad`, navy `#1f3a93`, gray, black and white → High. All nine real swatches also
  classify to their own level by hue alone, so rule 1 and rule 3 never disagree today.
- **Priority is stored in more than tasks** (measured Sep 2026), and every copy must convert in
  the same migration:
  - recurring templates — `recurringTemplates[id].highPriority` / `.priorityColor`, written by
    the priority toggle (`taskCRUD.js`) and read by `recurringWatcher.js` to recreate the task
  - the cleared-task archive — `clearedTasks.entries[].wasHighPriority` / `.priorityColor`,
    used by `clearedTasksManager.js` to recreate a cleared task
  - history event details — `priorityColor`, rendered by `historyManager.js`

  Miss one and a recreated task comes back without its priority.
- **`.mcyc`:** the published schema changes; the importer keeps accepting 2.5
  `highPriority` / `priorityColor` and converts them with the rule above.
- **UI:** picker swatches are labelled High / Medium / Low (colour still shown), the accessible
  name states the level, and "Priority First" sorts high → medium → low → none from state.
- **The gate:** `validateSchema25Structure()` must accept the new shape, exactly as for the
  renames.

### Transitional helpers (Sep 2026)

`modules/utils/priorityLevel.js` (pure, no DI) treats priority as a level today while reading and
writing **only the 2.5 fields**:

| Helper | What it does on 2.5 data |
|---|---|
| `getPriorityLevel(task, swatchSets)` | level from `highPriority` + the stored hex; flagged with no or unknown colour → `'high'` *(an unknown colour should use the colour-family rule — update before wiring into the UI)* |
| `getPriorityColor(task, swatches, swatchSets)` | display colour: a swatch colour follows the current theme, no colour → the theme's High; a custom hex is still shown as stored *(should become its family level's theme colour — same update)* |
| `setPriorityLevel(task, level, swatches)` | writes `highPriority` and the theme's swatch hex; `null` turns priority off and keeps the colour, like the toggle |
| `comparePriority(a, b, swatchSets)` | sort order high → medium → low → none |
| `getPrioritySwatches(theme)` / `collectSwatchSets(THEME_DEFINITIONS)` | the active theme's set (defaults for classic) / every theme's set |

Supporting data: `PRIORITY_LEVELS` and `DEFAULT_PRIORITY_SWATCHES` in `constants.js` (now also
the picker's fallback, so the two cannot drift), and a `level` on every theme `priorityColors`
entry. Tests guard that every theme defines each level once and that no hex means two levels.

**Not wired in yet.** Rendering, the picker and search still use the 2.5 fields directly.
Switching them onto these helpers is steps 3–4 of the agreed sequence (*Ordering*): first add the
colour-family rule to the helpers, then wire them in. That changes visible behaviour: priority
colours start following the theme, and "Priority First" becomes level-aware.

---

## Migration seam

**Migration lives in `modules/routine/migrationManager.js`**, not in `routineLoader.js`.
The previous doc named the wrong file; `routineLoader.js`'s only `schemaVersion` code is the
per-task integer repair described above.

Existing entry points, all named for 2.5 — a 2.6 step means generalising these or adding a
parallel chain beside them:

| Function | Role |
|---|---|
| `checkMigrationNeeded()` | decides whether a migration runs |
| `simulateMigrationToSchema25(dryRun)` | dry-run path |
| `performSchema25Migration()` | the actual transform |
| `initAppWithAutoMigration(options)` | boot-time entry |
| `forceAppMigration()` | manual trigger |
| `createInitialSchema25Data()` | fresh-install shape |

A migration function is deliberately **not** sketched here. The previous doc's example was
written against the wrong shape and would have thrown on real data; write it against
`SCHEMA_2_5.md` and the functions above.

**Starting point (product owner, Sep 2026): pre-2.5 predates the public launch at minicycle.app,
so every user has only ever had 2.5.** The new
migration therefore goes **2.5 → 2.6 only** — nothing in 2.6 needs to handle pre-2.5 storage
directly. Pre-2.5 data can still *arrive*, through two paths that exist today:

- at boot, `orchestrator.js` calls `initAppWithAutoMigration()`, which still migrates the legacy
  keys (`miniCycleStorage`, `lastUsedMiniCycle`, `miniCycleReminders`) whenever they are present
- `backupRestoreManager.js` still restores legacy backup files through the same migration — only
  a pre-launch backup file could carry pre-2.5 data, since no public user ever had it

**Decided Sep 2026: retire the pre-2.5 migration before 2.6**, as its own release (see
*Ordering*), so the bundled migration is 2.5 → 2.6 with no legacy chain to build or test.
Why it is safe: pre-2.5 predates the public launch, so no public user ever had pre-2.5 data —
at most a pre-launch test browser or file could. Also measured: `schemaVersion "2.5"` is in the
repo's first commit (Sep 2025);
outside `migrationManager.js` itself (the migration and its rollback), nothing writes the legacy
keys; the Lite version stores its own `miniCycleLite` object, not the legacy format; and the
`miniCycle.html` rescue screen accepts only the current backup format.

**Keep:**

- the boot entry — every user passes through `initAppWithAutoMigration()`, and it is what
  creates the initial state for a brand-new user; only its legacy branch goes
- `createInitialSchema25Data()` (fresh installs) and `fixTaskValidationIssues()` (called at
  boot, not legacy-specific)

**Remove** whatever only serves pre-2.5 data — audit each `migrationManager.js` export rather
than trusting a list — and every reference to it: `migrationFacade.js`, the
`performSchema25Migration` entry in `moduleLoader.js` depMappings and its manifest declarations
(the DI pipeline; `validate:di` / `validate:api` gate it), the legacy branch of
`backupRestoreManager.js`, `STORAGE_KEYS.LEGACY_DATA` (update the `validate:reset` list), the
legacy restore label keys, the testing-modal backup code, and the tests that pin the legacy path.

**No special handling for leftovers.** No public user ever had pre-2.5 data, so keep it minimal:

- stop reading the legacy keys; if any exist (a pre-launch test browser), leave them untouched —
  never delete them
- a legacy backup file gets the same error message as any backup the app cannot read (confirm
  which label when implementing)
- add **no** new download or warning UI — it would be new code for a case no user has

---

## The gate you must not miss

**`appState.validateSchema25Structure()` (`modules/core/appState.js`) decides whether
stored data is adopted at all.** It is called from first load, corruption recovery, cross-tab
foreign writes, save-time conflict checks, and restore — list every call site with
`grep -rn "validateSchema25Structure(" web/modules` when the work starts rather than trusting a
count here.

If it is not taught about 2.6, every 2.6 payload is rejected as invalid and the app behaves
as though the user has no data. This is the single highest-consequence omission in the
previous plan, which never mentioned it.

---

## Built to adapt — forward compatibility (verified Sep 2026)

2.6 must stay as adaptable as 2.5 — and fix the places where 2.5 is not.

**What 2.5 gets right — keep it.**

- The `.mcyc` schemas are open: `additionalProperties: true` at the root, on tasks and on
  `recurringSettings`, and the format page promises unknown keys are ignored, not errors.
- Every shipped format version has its own permanent, immutable schema URL.
- The stored-data gate checks only the keys it needs (`schemaVersion`, `data.cycles`,
  `appState`), so extra keys never make data invalid.
- Cross-tab sync ignores external data it cannot validate instead of adopting it.

**Where 2.5 is not adaptable — fix it in 2.6.**

1. **One closed object in the published format.** `deleteWhenCompleteSettings` is
   `additionalProperties: false`, so a third mode key fails strict validation — even though
   `syncTaskDeleteWhenComplete` in `cycleMode.js` is written to carry one. Make `autoClear` open
   to new mode keys: `"additionalProperties": { "type": "boolean" }`.
2. **"Ignored" means dropped.** `cycleImportManager` rebuilds each task from a fixed field list,
   so fields a newer app added do not survive an import into an older one — which is why the
   exporter dual-writes (`.mcyc` obligation 5). **Decided Sep 2026: 2.6 does not carry unknown
   task fields through import and export** unless a real need appears. If one does, pass them
   through only after the same sanitising as known fields.
3. **Exact version checks make an older build destructive.** Every check is
   `schemaVersion === '2.5'` — the `appState` gate, `dataRecovery.js`, `dataValidator.js`,
   `dataSanitizer.js`, `backupRestoreManager.js`, `migrationManager.js`. What a 2.5 build does
   when it meets newer stored data, read from the code:
   - **first load** (`appState.init`): the gate fails, the 2.5-only recovery fails, and `data`
     is set to `null` — the user is treated as brand new, and the first-run flow then writes a
     new document over the newer one *(that last write is inferred from the first-run flow, not
     executed)*
   - **saving** (`appState.save`): a foreign write that fails the gate is not adopted, and the
     stale tab's 2.5 state is written over it — the code comment calls that the correct outcome
     for *malformed* data, which newer data is not
   - **migration detection** (`checkMigrationNeeded`): does not recognise the newer version and
     falls through to legacy-data detection *(outcome not traced)*
   - **cross-tab sync and full-data import**: rejected safely

   A lagging Android, iOS or Chrome build, or a tab left open across the release, reaches exactly
   these paths.

**Probed Sep 2026 (v2.564) — the two inferred outcomes above, measured.** Seeding a `2.6`
document and booting: the build showed the first-run choice screen with the data intact, and
the "learn" choice changed nothing, because `AppState.update()` refuses while `data` is null —
a dead end, not an overwrite. The **stale-tab case reproduced exactly**: a tab with valid 2.5 in
memory added a task, and its debounced save replaced the 2.6 document — version back to 2.5,
the newer routine gone, `lastModifiedBy` the stale tab.

**Requirements for 2.6.**

- **One shared version check** ✅ *built Sep 2026:* `utils/schemaVersion.js` —
  `classifyStoredVersion()` returns *current* / *older* / *newer* / *unknown*, comparing parsed
  numbers, never strings (`"2.5" > "2.10"`; `STATE_TRUTH_MIGRATION.md` #22). `AppState` uses it
  at init, reload, save and the cross-tab handler. The remaining exact-match checks in
  `dataRecovery`, `dataValidator`, `dataSanitizer`, `backupRestoreManager` and `migrationManager`
  still say "2.5"; they are restore/import paths that reject rather than overwrite, and they
  move onto the classifier when 2.6's migration is written.
- **Newer data is never overwritten** ✅ *built Sep 2026, decided as refuse-with-a-message:*
  `AppState` neither adopts a newer document (init, reload, cross-tab) nor writes over it
  (`save()` refuses and keeps the edit dirty), latches `isBlockedByNewerData()`, and warns once
  with a Reload action; `appInit.showNewerDataNotice()` replaces the first-run / corruption flows
  with a single Reload button. Pinned by `appState.tests.js` and the journey *"data written by a
  newer build is never overwritten"*. **Must reach the platform builds before 2.6 changes the
  stored format.**
- **Migrations chain one version at a time** (2.5 → 2.6, later 2.6 → 2.7) instead of 2.6-named
  copies of the 2.5 functions, so the next change is one more step.
- **New `.mcyc` objects are open by default.** A closed object needs a written reason.

---

## The reconciler you must not break

Rename A removes a field. Before removing it, understand what currently holds the design
together, because a mechanical sweep can silently delete it.

`deleteWhenCompleteSettings {cycle, todo}` is the durable truth; `deleteWhenComplete` is a
flat mirror. **They arrive disagreeing on every import.** A shared `.mcyc` that omits both —
which the published schema instructs authors to do, marking the flat field *"DERIVED, so do
not author this"* — imports with mirror `true` and `settings.cycle` `false` (measured).

The two consumers read different fields:

- `taskDOM.js:665` and `focusTaskPanel.js:387` **render** through `resolveDeleteWhenComplete()`
- `taskCycleReset.js:340` and `:741` **delete** on the raw mirror

What makes that safe is **`syncTaskDeleteWhenComplete()` in `modules/utils/cycleMode.js`**,
called on load from `routineLoader.js:320`. It re-derives the mirror from the map and writes
the corrected value back to storage before the user can act. Measured across a reload:
stored mirror `true` → `false`.

**It is the entire safety margin.** Mutation-testing it (v2.517-era, tests only) disabled the
helper and the outcome was a **deleted task** — `remaining task ids: []` — for a task whose
stored setting said keep. It is now covered by:

- `tests/cycleImportManager.tests.js` — three tests on the per-mode map the importer emits
- `tests/automated/run-journey-tests.cjs` — journey *"imported delete-settings reconcile and
  KEEP is honoured"*, which asserts the reconciliation **in storage** and then the survival
  that depends on it

Collapsing to a single `autoClear` field **removes the need for this reconciler entirely** —
with one field there is nothing to reconcile. That is the strongest argument for doing
Rename A. Until it is collapsed, do not touch `routineLoader.js:320`.

---

## `.mcyc` and the published JSON Schemas

The previous doc had this backwards. Corrected by measurement:

**Rename B does not touch the file format.** A `.mcyc` is a **single flattened routine** —
`name`, `title`, `tasks`, `autoReset`, `cycleCount`, `recurringTemplates` — with no cycles
map and no `activeCycleId` (0 references in `mcyc.schema.json`). **Do not** write schema
detection, auto-migration, or a *"file format updated"* notification for it; that would tell
users something untrue about a format that did not change.

**Rename A does touch it.** `deleteWhenCompleteSettings` and `deleteWhenComplete` are part of
the published format (`mcyc.schema.json`, `schema/mcyc-2.5.schema.json`, and several mentions
in `pages/mcyc-format.html`).

**Priority levels touch it too.** `highPriority` and `priorityColor` appear in
`mcyc.schema.json`, `schema/mcyc-2.5.schema.json` and `pages/mcyc-format.html`. The obligations
below apply to them exactly as to Rename A — the importer accepts `highPriority` /
`priorityColor` permanently, and the exporter writes `priority` (plus the 2.5 fields during the
transition window — obligation 5) — so publish both changes in the same `mcyc-2.6.schema.json`.
The 2.5 schema accepts **any** hex, so a hand-written file can hold a custom colour; **decided
Sep 2026, it imports as the level of its colour family** (the hue rule in *Priority levels*).
The file keeps importing and the author's rough intent survives as a level, but the exact colour
does not — 2.6 has no per-task colour. The format page should say so: priority colours follow the
reader's theme, and a custom colour becomes High, Medium or Low. The sample routines in
`examples/routines/` use the 2.5
fields; they keep importing through the permanent alias, and should be converted when 2.6 ships
so the examples show the current format.

**The rules here are already published**, on <https://minicycle.app/pages/mcyc-format>. They
are a public commitment to anyone building on the format, not an internal convention this
plan gets to set:

> *"Our intent for anything built on this: existing files keep importing. New fields may be
> added, so treat unknown keys as ignorable rather than as errors, which is also how the app
> treats them."*
>
> *"Each format version gets its own permanent URL (`/schema/mcyc-2.5.schema.json` today),
> and a version that has shipped is never edited in place. If the format reaches 2.6, that
> becomes a new file and the 2.5 document stays exactly as it is."*

The page names this exact scenario by version number, so Rename A's obligations are already
decided:

1. **`schema/mcyc-2.5.schema.json` is immutable.** Not "avoid changing" — the promise is that
   anything pinned to it keeps validating as it did the day it was pinned.
2. **Publish `schema/mcyc-2.6.schema.json`** beside it and add its row to the format page's
   version table.
3. Update the rolling **`mcyc.schema.json`** to describe `autoClear`. Adding a field is
   explicitly anticipated ("new fields may be added").
4. **`cycleImportManager` accepts `deleteWhenCompleteSettings` permanently.** "Existing files
   keep importing" has no end date, so this is an alias, not a deprecation window. Add one
   import test per alias so a future cleanup that drops it fails loudly.
5. **`mcycPayload` / `cycleExportManager` write the 2.6 fields and, during a transition window,
   the 2.5 fields too — decided Sep 2026.** The published promise only says unknown keys must
   not error, so an older app reading a new file falls back to defaults and silently loses the
   author's choice (measured — that is the documented default path). The Android, iOS and
   Chrome builds are on-demand snapshots that lag the web app, so that older reader is real.
   A 2.6 export therefore also writes:
   - `deleteWhenCompleteSettings` / `deleteWhenComplete` beside `autoClear`
   - `highPriority` / `priorityColor` beside `priority` — the colour is the level's default
     swatch

   Rules: when both are present the importer **prefers the 2.6 field**, so the duplicate never
   needs reconciling. The window closes only when every shipped platform build can read 2.6 —
   tie it to platform releases, not a count of web releases.

**Three version lines exist here, and they move independently:** the app data schema
(`"2.5"`), the `.mcyc` format (no field in the document at all — detect by key presence), and
the per-task integer `schemaVersion` (`2`). Do not bump one because another moved.
`docs/reference/MCYC_FILE_FORMAT.md` conflated the first two until Aug 2026.

---

## Surface inventory

Files pinning the schema string or the renamed fields, excluding `archive/`, `dist/`,
`lite/` and `backup/`. The previous doc listed six files; these are the ones that exist.

**Core / state**
`core/appState.js` · `core/appGlobalState.js` · `core/constants.js` · `core/types.js` (JSDoc typedefs)

**Routine / migration**
`routine/migrationManager.js` · `routine/routineLoader.js` · `routine/routineManager.js` · `routine/modeManager.js`

**Data integrity — none of these were in the previous plan**
`utils/dataValidator.js` · `utils/dataRecovery.js` · `utils/dataSanitizer.js` ·
`storage/backupManager.js` (IndexedDB blobs) · `ui/undoIndexedDB.js` (persisted undo stacks,
keyed by `cycleId`) · `ui/backupRestoreManager.js` ·
the first-run rescue screen in `miniCycle.html`, which accepts **two** backup formats

**Import / export / share**
`ui/cycleImportManager.js` · `ui/cycleExportManager.js` · `ui/shareManager.js` ·
`utils/mcycPayload.js` · `mcyc.schema.json` · `schema/mcyc-2.5.schema.json` · `pages/mcyc-format.html`

**Task / recurring (Rename A concentrates here)**
`task/taskCycleReset.js` · `task/taskButtons.js` · `task/taskDOM.js` · `task/taskCRUD.js` ·
`task/taskUtils.js` · `task/taskDOMPatch.js` · `utils/cycleMode.js` · `utils/globalUtils.js` ·
`recurring/recurringActivation.js` · `recurring/recurringTemplate.js` ·
`recurring/recurringSettingsApplicator.js` · `ui/focusTaskPanel.js` ·
`ui/undoTransactionDiff.js` · `ui/undoSnapshotUtils.js` · `features/clearedTasksManager.js`

**Priority levels (measured Sep 2026) — in addition to the task, import and undo files above**
`utils/notifications.js` (the picker) · `ui/taskSearch.js` (Priority filter and "Priority First"
sort, via the `high-priority` class) · `labels/themes.js` (swatches) · `labels/defaultLabels.js`
(Red / Yellow / Green → High / Medium / Low) · `features/themeManager.js`
(`colorPreset.priorityColor` → CSS variable) · `features/historyManager.js` ·
`recurring/recurringWatcher.js` · `ui/settingsUIManager.js` · `ui/preferencesManager.js` ·
`ui/taskOptionsCustomizer.js` · `utils/dataValidator.js` · `routine/routineSwitcherActions.js` ·
`routine/routineSwitcherRepair.js` · `task/taskEvents.js` · `task/taskCore.js` ·
`utils/priorityLevel.js` · `styles/components/task-options.css` · `examples/routines/`

**Easily missed**
`games/miniCycle-taskGame.js` · `games/miniCycle-taskOrder.js` · `games/miniCycle-taskScramble.js` ·
`modules/testing/testing-modal-{analysis,backup,debug,diagnostics}.js` ·
`scripts/collect-stats.cjs` · `scripts/capture-store-screenshots.cjs` · `pages/product.html` ·
**many `tests/*.tests.js` files** (list them with a grep for the renamed fields when work starts)

**Labels.** Rename A should also retire `taskOption.markedForClearing` /
`taskOption.clearOnReset` as *separate* keys only if the UI genuinely stops distinguishing
the modes — it currently does, deliberately, so **keep both labels**. The rename is to the
stored field, not to what users read.

---

## Testing

This repo does **not** use Jest. The previous doc's `describe`/`expect` examples were not
runnable here. Two harnesses:

**Module tests** — `tests/<module>.tests.js`, a custom browser harness. Throw to fail:

```javascript
await test('2.5 → 2.6 renames the delete pair to autoClear', () => {
    const migrated = mod.migrateSchema_2_5_to_2_6(fixture25());
    const task = migrated.data.cycles.morning.tasks[0];   // Rename B not yet applied
    if (!task.autoClear || typeof task.autoClear.cycle !== 'boolean') {
        throw new Error(`autoClear missing: ${JSON.stringify(task)}`);
    }
    if ('deleteWhenComplete' in task || 'deleteWhenCompleteSettings' in task) {
        throw new Error('legacy delete fields should not survive migration');
    }
});
```

**Journey tests** — `tests/automated/run-journey-tests.cjs`, real boot in Playwright,
asserting persisted state. This is the layer that catches schema regressions module tests
miss. Add a journey that boots a 2.5 payload, confirms migration, and confirms a task whose
`autoClear.cycle` is `false` still survives a cycle reset. For priority, boot a 2.5 payload
whose flagged tasks carry another theme's swatch colours and custom hexes from each colour
family (e.g. orange → Medium, teal → Low, blue → High), plus a flagged recurring template and a
flagged cleared-task entry; assert the stored levels, the colour rendered under the current
theme, and that recreating the recurring and cleared tasks keeps their level.

**Mutation-test every new assertion.** Prove it fails without the change. The existing
delete-reconciliation journey exists because a first mutation attempt passed — the test was
fine, the guessed mechanism was wrong.

**Gates that must stay green** (`npm run` targets): `lint`, `test`, `test:sw`, `test:meta`,
`test:layout`, `test:journey`, `test:a11y`, `test:changelog`, `test:restore`, and
`validate:{csp,html,docs,di,comments,builtins,labels,chains,api,cache,provides,inline,legacy}`.
`test:sw` matters for **any** new file under `modules/`, not only boot-graph ones: its precache
drift guard walks every module file and fails unless it is precached or in `PRECACHE_EXEMPT`
(measured Sep 2026, when `utils/priorityLevel.js` tripped it before anything imported it).

---

## Ordering relative to other plans

**Agreed sequence (Sep 2026).** Steps 1–5 change no stored format, so nothing below blocks them;
they deliver the user-visible priority improvements and the safety net early, and keep the
risky stored-format change small and last.

1. **Forward-compatibility release** — ✅ *code landed Sep 2026 (see Built to adapt)*. Ship it and
   let it reach the platform builds, so no build that can meet 2.6 data will destroy it. It must
   be out before step 7.
2. **Theme presets → High swatch** — ✅ *done Sep 2026.* Each theme's `colorPreset.priorityColor`
   now equals its High swatch (fitness's green default is gone), guarded by a test in
   `themes.tests.js`.
3. **Colour-family rule in the helpers.** Update `utils/priorityLevel.js` so an unknown hex takes
   its colour family's level (the hue rule in *Priority levels*) and `getPriorityColor` shows
   that level's theme colour instead of the stored hex. The rule's tuning values — the hue
   anchors (0°, 50°, 125°), the 45° range, and the saturation and lightness cutoffs — go in
   `core/constants.js` (CLAUDE.md rule #5), not inline in the helper. Pin the measured examples
   in `priorityLevel.tests.js` and mutation-verify them.
4. **Wire the helpers into the UI** — visible behaviour change, still on 2.5 data:
   - the picker labels its swatches High / Medium / Low and the accessible name states the level
   - renderers (`taskDOM`, `taskDOMPatch`, `focusTaskPanel`) take their colour from
     `getPriorityColor`, which also retires the three disagreeing fallbacks
   - search's Priority filter and "Priority First" sort use the level from state instead of the
     `high-priority` class
5. **Retire the pre-2.5 migration** (decided Sep 2026). Remove the legacy migration and rollback,
   keep the boot entry and initial-state creation. No leftover-data UI: pre-2.5 predates the
   public launch, so legacy keys are simply left untouched and a legacy backup file gets the
   normal unreadable-backup message. Details in *Migration seam*. Must ship before step 7, so the
   migration is 2.5 → 2.6 only.
6. **`STATE_TRUTH_MIGRATION.md` P0 and P1 come first for the stored-format work.** It says so
   explicitly: *"Do not start at schema 2.6 or UUID keys. Collapse Gen 1 on the loop first."*
   Its P1 fixes the state, undo and persistence code a migration runs on. Do its AppState load /
   save items together with step 1, so that code is reworked once.
7. **One migration, one version bump (decided Sep 2026).** A single 2.5 → 2.6 migration carries:
   - the **UUID re-key** — `STATE_TRUTH_MIGRATION.md` #20: stable UUID map keys, `title` as the
     name. Today routines are keyed by name, which is also a CLAUDE.md #18 prototype-pollution
     hazard
   - **Rename A** — `deleteWhenComplete*` → `autoClear`
   - **Rename B** — `cycles` → `routine`, done while the map is rewritten anyway
   - **priority storage** — `task.priority` levels

   Rename A and priority change the published `.mcyc` format, so they share one format bump,
   with dual-written exports during the transition window. Build the migration as ordered,
   separately tested steps inside one function and one version bump — never as separate
   releases.
8. **`TASK_ORDERING_SYSTEM_PLAN.md` is independent of the migration** (corrected Sep 2026). Its
   `order` field is additive with a default, so it needs no version bump and does not ride
   this bus; its recurring-position problem was fixed separately by `template.position`. Do it
   when task numbering is wanted, after `STATE_TRUTH_MIGRATION.md` P1.

`APPSTATE_MERGE_STATES.md` notes a schema change is a natural moment to revisit merge
semantics; it does not block and is not scheduled.

---

## Effort

The previous "2–3 days" estimate was built on a six-file surface and is not survivable.

**No counts are pinned here** — they go stale. `docs/PROJECT_STATS.md` is the source of truth for
codebase size; measure each change's own surface when its work starts, for example:

```bash
cd web
grep -rhoE '\bdeleteWhenComplete[A-Za-z]*\b' modules tests | wc -l     # Rename A
grep -rhoE '\bactiveCycleId\b|\.cycles\b' modules tests | wc -l        # Rename B
grep -rhoE '\b(highPriority|priorityColor|wasHighPriority)\b' modules tests | wc -l   # Priority
```

- **Rename A** — moderate surface, plus the published-schema work and the field collapse.
  The collapse is the careful part: the two deletion sites in `taskCycleReset.js` must move to
  the resolver in the same change that removes the mirror.
- **Rename B** — the widest surface, mechanical but broad, and the review pass dominates.
- **Priority levels** — a surface comparable to Rename A, plus converting every stored copy
  (tasks, recurring templates, cleared-task entries, history details), switching the picker,
  search and renderers onto the level, and the `.mcyc` format work shared with Rename A. The
  transitional helpers in `utils/priorityLevel.js` already hold the swatch mapping; the
  colour-family rule for custom hexes still has to be added to them.

- **UUID re-key** (`STATE_TRUTH_MIGRATION.md` #20) — bundled into the same migration; every
  place that looks a routine up by name has to move to the id.

None of these is a "day," and bundled they make one large release. Treat the migration function
as the small part and the audit of the surfaces above as the real work.

---

## Risks

| Risk | Mitigation |
|---|---|
| `validateSchema25Structure` not updated → all 2.6 data rejected as invalid | Update it and every call site in the same change; add a journey booting a migrated payload |
| Reconciler removed during the sweep before the field collapse lands | Do not touch `routineLoader.js:320` until `autoClear` is single-field; journey *"imported delete-settings reconcile and KEEP is honoured"* fails loudly if it goes |
| Frozen `schema/mcyc-2.5.schema.json` edited | It is a published external contract — add 2.6 beside it, never edit it |
| Backups in IndexedDB and the two rescue-screen formats still hold 2.5 | Restore must migrate on read, not assume the current version |
| Data loss during migration | Automatic backup first; validate after; `test:restore` covers the rollback generator |
| Half-migrated stored data if a sweep is partial | One migration function, one version bump, no field-by-field rollout |
| Priority converted on tasks but not on recurring templates, cleared-task entries or history | Convert all four in the one migration; the priority journey recreates a recurring and a cleared task and asserts the level survives |
| Persisted undo history restores pre-migration snapshots — `undoIndexedDB.js` keeps undo stacks in the `miniCycleUndoHistory` IndexedDB (`undoStacks` store, keyed by `cycleId`) and reloads them on boot and routine switch; the snapshots hold 2.5 priority and delete fields, and the key itself is a Rename B name | **Clear** persisted undo history at the version bump (decided Sep 2026 — far simpler than migrating snapshots, and losing undo across a version bump is acceptable); applies to all three changes |
| A custom hex in a shared `.mcyc` maps to a surprising level | Decided: the hue colour-family rule, not nearest-colour (which mapped navy to High and black to Low); tests pin the measured examples for every family and the "no clear colour → High" fallback |
| A theme's `colorPreset.priorityColor` contradicts the level colours (fitness: a green default) | Decided: set it to the theme's High swatch; a test in `priorityLevel.tests.js` keeps the two equal for every theme |
| An older build (lagging platform build, or a tab open across the release) meets 2.6 stored data and treats the user as new, or saves its 2.5 state over it | Ship the forward-compatibility release first; a journey seeds data with a newer `schemaVersion` and asserts it is neither overwritten on load nor on save |
| A 2.6 `.mcyc` opened in an older build silently loses clear and priority settings | Exporter dual-writes the 2.5 fields until every platform build reads 2.6; importer prefers the 2.6 field when both are present |
| The bundled migration (re-key + Rename A + Rename B + priority) is large: one bug blocks the whole release, and it is hard to review | One migration function built from ordered steps, each with its own tests; dry-run on real backups before release; automatic backup first; the forward-compatibility release is already out so no older build can destroy the result |
| Retiring the pre-2.5 migration strands someone's data | Negligible: pre-2.5 predates the public launch at minicycle.app, so only a pre-launch test browser or file could hold it. Legacy keys are left untouched (never deleted), a legacy backup gets the normal unreadable-backup message, and the boot entry and new-user initial state are kept |

---

## Success criteria

- [ ] 2.5 data migrates with zero loss, verified on a real backup
- [ ] `validateSchema25Structure` (or its successor) accepts 2.6 at every call site
- [ ] `autoClear` is a single field; no mirror remains; `taskCycleReset` reads via the resolver
- [ ] `schema/mcyc-2.5.schema.json` byte-identical; `schema/mcyc-2.6.schema.json` published;
      format page lists both
- [ ] Importer accepts `deleteWhenCompleteSettings` **and** `autoClear`
- [ ] Priority is a level on tasks, recurring templates, cleared-task entries and history
      details; every theme's swatch colours map to the right level
- [ ] Importer accepts `highPriority` / `priorityColor` **and** `priority`
- [ ] Picker labels, accessible names and "Priority First" sort are level-aware;
      persisted undo history cleared at the version bump
- [ ] A non-swatch colour from a `.mcyc` imports as its colour family's level (hue rule), with
      the measured examples pinned by tests; `priorityLevel.js` uses the same rule
- [ ] Every theme's `colorPreset.priorityColor` equals its High swatch, guarded by a test
- [ ] One shared version check replaces every `schemaVersion === '2.5'`; data newer than the
      build is never overwritten, and that behaviour shipped before the format changed
- [ ] Migrations chain per version; `autoClear` and any new `.mcyc` objects are open to new keys
- [ ] Exports dual-write the 2.5 fields during the transition window; the importer prefers 2.6
      fields when both are present
- [ ] The UUID re-key, Rename A, Rename B and priority storage land in **one** migration and one
      version bump; each step is tested on its own and the whole is dry-run on real backups
- [ ] The pre-2.5 migration is retired **before** 2.6 ships; the 2.6 migration is 2.5 → 2.6 only
- [ ] Legacy keys are no longer read and never deleted; a legacy backup file gets the normal
      unreadable-backup message; no new UI was added for pre-2.5 data
- [ ] A brand-new user still gets initial state at boot; `validate:di`, `validate:api` and
      `validate:reset` are green after the legacy references are removed
- [ ] Full suite and every gate green (see [Testing](#testing))
- [ ] New migration tests, each mutation-verified
- [ ] `SCHEMA_2_5.md`, `DATA_SCHEMA_GUIDE.md`, `MCYC_FILE_FORMAT.md`, `CLAUDE.md` updated;
      a `SCHEMA_2_6.md` written

---

## Future considerations

**Dev-build `validateTask()` enforcement** *(carried from the archived
HIGH_PRIORITY_NULL_DEFAULT_FIX postmortem)* — route task creation through `validateTask()` in
dev builds so field-default drift is caught where objects are born. Precedent: the
`highPriority: null` bug (fixed v2.398) shipped because a creation path defaulted a field
differently from the schema.

**Superseded in September 2026 for `highPriority` / `priorityColor`.** This section used to say
the plan deliberately leaves them alone, because they are a flag plus an optional per-task colour
— not a mirrored pair, no dual-write, no drift — and restructuring them buys no *correctness*.
That reasoning still holds: the September change is a product decision (levels, colours that
follow the theme, a signal that is not colour alone), not a bug fix — see **Priority levels**.
The validator point stands too: the `highPriority: null` wart was a validation problem, and a
dev-build `validateTask()` helps whatever shape priority takes.

---

## What was wrong before

Recorded so the same errors are not reintroduced. The pre-Aug-2026 version of this document:

- **Described a `miniCycle` wrapper** (`data.miniCycle.data.cycles`,
  `data.miniCycle.appState.activeCycleId`) that this codebase has never used — 18
  occurrences, and the only doc in the repo with that shape. Its migration function would
  have thrown on the first property access.
- **Put the migration in `routine/routineLoader.js`.** It lives in `migrationManager.js`.
- **Conflated the document `schemaVersion` string with the per-task integer.**
- **Specified `.mcyc` auto-migration and a user notification for Rename B**, which does not
  affect the file format — and said nothing about Rename A, which does.
- **Never mentioned `validateSchema25Structure`**, the gate that decides whether data loads.
- **Listed six files to update**; the real surface is in the inventory above.
- **Used Jest examples** that cannot run in this repo.
- **Estimated 2–3 days** on that six-file premise.

The status line said "premise re-verified Aug 2026." That check confirmed only that the
rename had not happened yet; it did not check the document's own shape against the code.
