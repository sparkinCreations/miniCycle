# Plugin System & Task Timer Plan

> **Status:** Proposed / future work — **not implemented**. Do not start until at least two miniCycle users have asked for timing (§1).

**Last verified:** Nov 6 2026  
**Priority:** One bounded feature initiative before focusing on Task Cycle; ship in independently testable stages  
**Owner:** sparkinCreations / miniCycle  
**Scope:** Optional first-party plugins (the first is Task Timer), with backup/restore and offline recovery that keep plugin data safe. One shared source for every build made from `web/`: the web app/PWA, the full Chrome extension, the iOS and Android apps, and the desktop app (§9a)

> **Implementation note:** This is a design and implementation plan, not a claim that the feature already ships. Reinspect each referenced module before editing; paths and behavior can change. Preserve miniCycle's existing AppState, dependency-injection, boot, routine, accessibility, and recovery contracts. Do not build a second application framework.

---

## 1. Executive decision

**Build a small, trusted, first-party plugin system using the structures already in miniCycle, with the same source supporting the web/PWA and generated full Chrome extension.** Make **Task Timer** the first optional plugin. Surface installation/discovery in the existing **Customize Task Buttons** interface. Installing/enabling it exposes a Play/Pause action on tasks, starts a parent routine timer on the first task Play, and records simple task and routine timing history.

**Do not:** replace the core schema with a different version for each user's installed plugins; require internet access to restore core routines; require a missing plugin to run before a backup can be restored; let backup data execute arbitrary code; or use this project to build Task Cycle's professional analytics and team workflows.

**Central invariant:** An unavailable, disabled, or incompatible plugin must never cause loss of routine data **or plugin-owned historical data**. A backup made while a plugin is unavailable must preserve its data.

### Product boundary

| miniCycle Task Timer plugin | Task Cycle paid product |
| --- | --- |
| Optional, installed/enabled only when wanted | Native part of professional workflow |
| Play/Pause on existing task option buttons | Rich job/work-session controls |
| Whole-routine elapsed time | Detailed job and task time reporting |
| Per-task elapsed time and basic session history | Structured results, comparisons, analytics, notes, team workflows |
| Minimal configuration | Advanced controls as needed |

Feature adoption should be driven by actual miniCycle user requests (at least two requests for timing), not by an attempt to mirror another app. Protect the core routine experience for users who do not install the plugin.

---

## 2. Verified existing foundation (Nov 5, 2026)

The following is **already in the repository**, but not a finished production plugin feature:

| Existing file | Observed state | Required work |
| --- | --- | --- |
| `web/modules/other/basicPluginSystem.js` | `EventBus`, `MiniCyclePlugin`, `PluginManager`; register/enable/disable, `onLoad`/`onUnload`, task and cycle hooks | Make manager available on demand, strengthen contracts/error handling, integrate actual core event sources |
| `web/modules/other/exampleTimeTrackerPlugin.js` | Example per-task timers, `startTimes`, completion handling, basic reports and `localStorage` session records | Adapt/rewrite as first-party Task Timer; add routine timer, pause/resume, persistence/recovery, native UI integration |
| `web/modules/other/pluginIntegrationGuide.js` | DI-based instructions; `setupBasicPlugins()` enables the example immediately if called; `addPluginHooks()` is a placeholder | Replace aspirational steps with real registration and dispatch; do not auto-enable timer for all users |
| `web/modules/boot/moduleManifests.js` | `basicPluginSystem` is optional and deferred; comment explicitly describes an inert substrate with no boot registration/UI entry point | Add a deliberate activation path that preserves zero behavior change for non-users |
| `web/modules/ui/taskOptionsCustomizer.js` | Existing per-routine `taskOptionButtons` settings, with live updates | Add optional “Task Button Plugins” discovery and per-routine visibility control |
| `web/modules/task/taskButtons.js` | Creates buttons from a fixed internal list | Add a narrow registry/extension point for trusted plugin-supplied buttons |
| `web/modules/task/taskCompletion.js` | Updates task completion in AppState; no observed plugin completion dispatch | Wire stable completion events **without changing critical async ordering** |
| `web/modules/task/taskCycleReset.js` | Has a guarded `pluginManager.triggerHook('cycleReset', …)` call | Verify all reset paths, event delivery/ordering, and deferred manager availability |
| `web/modules/ui/backupRestoreManager.js` | Portable file backup, restore validation, safety-backup step, document write, recovery behavior | Extend both export/restore to include plugin manifest and durable plugin data |
| `web/modules/storage/backupManager.js` | IndexedDB auto/manual/session backups; portable backup envelope builder | Include plugin data and version metadata in snapshots and exported files |
| `web/modules/boot/orchestrator.js` | Separate rescue-screen backup shape, normalized by restore manager | Extend normalization and ensure rescue backups retain plugin data |
| `web/modules/utils/dataValidator.js`, `web/modules/utils/dataSanitizer.js`, `web/modules/utils/schemaVersion.js` | Schema/restore gatekeepers | Add separate, safe validation for optional backup plugin sections |
| `web/modules/utils/mcycPayload.js` and `web/mcyc.schema.json` | `.mcyc` routine imports use a defined field set; unknown task properties can be dropped | Do not rely on ad-hoc custom task properties surviving routine export/import |
| `chrome/README.md`, `web/scripts/build-chrome-full.cjs` | Full MV3 side-panel extension is generated from `web/`; Lite is a separately maintained popup | Build the first-party plugin once in web source and verify the packaged Chrome output; do not hand-edit generated copies |
| `chrome/full/manifest.json`, `chrome/full/modules/other/basicPluginSystem.js`, `chrome/full/modules/other/exampleTimeTrackerPlugin.js` | Current generated full extension already includes the plugin substrate and example tracker; extension uses MV3 `sidePanel` | Keep executable plugin modules packaged, lazy/optional at runtime, and validate extension CSP and offline activation |

**Version details:** `SCHEMA.CURRENT` is currently the core document string **`"2.6"`** and individual tasks carry their own numeric `schemaVersion: 2`. A plugin's `dataVersion` must be **a third, independent version**, not a replacement for either.

**Important timing seam:** `handleTaskCompletionChangeImpl` documents that its first `await AppState.update(...)` must remain the first await; the caller can immediately check auto-cycle completion. A plugin event added too late could arrive after reset, and an await inserted too early could break cycle completion. Test the last-task auto-reset path before choosing where to emit plugin lifecycle events.

---

## 3. User experience — plugin discovery and activation

### Proposed Task Options Customizer flow

1. User opens **Customize Task Buttons** for a routine.
2. The existing standard buttons remain as they are.
3. New section: **Task Button Plugins** → **Available** → **Task Timer**.
4. A short description explains: “Track elapsed time for your routine and individual tasks.”
5. User presses **Install** (or **Enable** if bundled in the app). No configuration wizard.
6. The plugin installs/enables for this miniCycle installation, while the **Show Timer Button** setting is controlled **per routine**.
7. When enabled for that routine, a Play/Pause task-option button appears; a compact routine timing strip appears at the bottom only while appropriate.
8. Disabling the plugin hides its UI but **does not delete sessions**. Explicit **Delete Timer Data** is a separate, confirmed action.

**Terminology:** For v1, prefer a **bundled first-party plugin**—the code is shipped and trusted with miniCycle but unloaded until enabled. The interface may say “Add” or “Enable” to avoid implying a download. True online install/download can be a later feature, provided it adds enough user value. Installation state is device-local; restored backups record *requested plugin functionality*, not proof that code exists on another device.

**Optional future entry point:** A small Plugins section in Settings or the main menu to review installed/enabled/pending plugins. Not required for the first release if the Task Options Customizer is sufficient. If added, it must reuse the same plugin registry rather than introduce a separate source of truth.

**UI requirements:** Keyboard operation, correct `aria-label` for Play/Pause, visible active state, reduced-motion support, focus preservation, Three Dots mode compatibility, and no surprise controls in routines with timing disabled. Reuse existing labels/theme conventions and CSS rather than injecting hard-coded floating panels.

---

## 4. Timer behavior — proposed v1 specification

### Core behavior

| User/system action | Current task timer | Routine timer | History |
| --- | --- | --- | --- |
| Press Play on Task A | Starts/resumes Task A | Starts routine if not running | Begin timestamps persist |
| Press Pause on Task A | Pauses Task A | **Continues** | Close task segment with `manual_pause` |
| Complete running Task A | Stops Task A | **Continues** | Close task segment with `task_completed` |
| Press Play on Task B while A runs | Auto-pause A, start B | Continues | Record A's segment end as `switched_task` |
| Press Play on Task B after A stops | Starts B | Continues | Record new B segment |
| Press **Stop Routine** in bottom strip | Stops any active task | Stops routine | Close both with `routine_stopped` |
| Routine auto/manual reset | Close task safely if running | Close routine safely | Reason `routine_reset`; never silently discard time |
| Remove/delete running task | Close its segment | Continues unless policy says otherwise | Reason `task_deleted`; retain past sessions |
| Disable plugin during timing | Close and save active sessions first | Close and save | Reason `plugin_disabled`; historical data remains |

**The routine timer measures cycles.** miniCycle's unit of progress is the **cycle** (one completion of the whole routine), not individual task checks, so the routine clock is framed as *how long this cycle took*: a cycle's timing runs from its first Play to the cycle's completion or reset, and history groups task segments under the cycle they belong to. Per-task time is the detail underneath, never a headline stat on its own (no "lifetime minutes per task" or per-task leaderboards).

**Start interaction:** The **first task Play** starts both the task and its enclosing routine clock. There is no extra “Start Routine” setup step. The routine clock is independent of individual task timing, so total routine elapsed time can exceed the sum of task segments.

**Simplicity constraint:** One active task timer per routine, and (for v1) **one active timed routine across the app**. Starting another task automatically closes/pauses the previous task segment. This avoids overlapping and double-counted individual durations. If a need for true parallel work later emerges, revisit it intentionally.

**Routine switch policy — confirm in implementation:** Suggested default for v1 is to **stop/pause active timing when switching away** and record `routine_switched`, rather than leave an invisible timer running in another routine. Decide whether re-entry resumes accumulated time or starts a new session; communicate the policy in a brief hint. Keep the behavior deterministic.

**Task uncheck / undo:** A time measurement is a historical observation, not a checklist boolean. Unchecking a completed task or undoing completion should **not silently erase a previously closed timing segment**. A future session may be started; if corrections are needed, provide an explicit history correction/deletion path rather than rewriting recorded evidence through unrelated Undo.

**History presentation:** A compact per-routine history list can show task, time range/duration, and why it ended. Include routine total and active task elapsed display. Do not add advanced charts, targets, billing rates, forecasting, comparisons, or configurable event rules in v1.

### Timekeeping and lifecycle

- Persist `startedAt` and accumulated milliseconds; derive display time from timestamps. `setInterval` is for display refresh **only**, never the source of truth.
- On pause/stop/complete, append one immutable *closed session segment* with an idempotent identifier. Starting again creates another segment; the UI may aggregate segments for readability.
- Persist running-session checkpoint data before relying on navigation, backgrounding, page close, or app process termination. On next boot, **recover or ask to close** interrupted sessions; never silently fabricate uninterrupted time if the app cannot establish that policy.
- Handle wall-clock changes sensibly: `Date.now()` can jump if the device clock changes. Consider `performance.now()` for same-process elapsed measurement and persisted wall timestamps for cross-restart recovery; define a documented fallback/flag for suspicious clock changes.
- Decide whether automatic reset due to last checked task should close timing before clearing/respawning tasks. **Exactly one** `task_completed` closure and **one** `routine_reset` closure should occur, with no double-counting.
- Ensure timer display survives task re-render, reorder, focus mode, completed-list movement, page visibility changes, and routine UI refresh. Plugin state must not be inferred from DOM elements.

---

## 5. Plugin architecture — extend, don't replace

### Public responsibilities

**PluginManager / trusted registry**

- Enumerates supported first-party plugins by stable id, description, version, compatibility, and UI contributions.
- Registers/loads/enables/disables a plugin; maintains installed/available/disabled/unavailable status.
- Exposes events through a stable, typed contract and isolates plugin failures from core behavior.
- Provides controlled storage, backup/restore, and migration facilities for plugin-owned data.
- Serves a **declarative task-button registry**, rather than requiring plugins to find/rewrite random task DOM nodes.

**Task Timer plugin**

- Owns its task/routine timing state machine, timing sessions, pause/resume and rendering data.
- Requests a Play/Pause button and a routine-bottom status strip through supported UI extension points.
- Responds to genuine task/routine lifecycle events; does not duplicate or override miniCycle's task completion logic.
- Owns **dataVersion** migrations, not `SCHEMA.CURRENT` migrations.

### Event contract (illustrative — not current API)

```js
// Proposed event payloads. Actual names and DI wiring to be decided.
{ type: 'taskCompleted', routineId, taskId, completed: true, occurredAt, eventId }
{ type: 'taskDeleted',   routineId, taskId, occurredAt, eventId }
{ type: 'routineReset',  routineId, occurredAt, eventId, resetReason: 'auto' }
{ type: 'routineSwitched', fromRoutineId, toRoutineId, occurredAt, eventId }
```

- Use **stable routine/task ids** already in the state model; never key history solely by display title or task text. Routine ids are stable since #114 (Nov 2026): every routine is keyed by its generated id (`id === key`), a rename changes only `title`, and boot re-keys any older title-keyed routine (`repairRoutineKeys` in `routine/schemaMigration26.js`). Before that, a rename moved a routine to a new key, so history keyed by routine would have lost its routine. Records made from this plan can key by `routineId` safely.
- Choose **one** event dispatch route. Avoid firing both `EventBus.emit` and `triggerHook` for the same logical event unless they have explicit separate purposes.
- Preserve **dispatch order** through task completion → optional auto-reset. Event delivery and duplicate suppression should be tested, including Complete All, recurring respawn, and Todo-style clear actions.
- Avoid synchronous plugin failures blocking core tasks; document what happens if plugin persistence fails and how the user is warned.
- Keep the manager deferred/on-demand for users without any enabled plugin. Confirm boot readiness and DI registration before loading a plugin.

### Task button extension point

Today, `taskButtons.js` creates buttons from a fixed array and a fixed accessibility-label map. Introduce something like a trusted `registerTaskOption({ id, icon, labelKey, onClick, visibleWhen, ariaPressed })` interface. Integrate with the per-routine customizer and the existing event/accessibility path. Plugin code should **not** append an unrelated button to a task DOM node by ad-hoc mutation as the production solution.

### Out-of-scope extensibility

No arbitrary JavaScript uploaded by users; no community marketplace, dynamic third-party download installer, remote catalog service, plugin permissions marketplace, cross-plugin dependency resolver, or plugin billing in this release. A first-party allowlisted catalog is sufficient.

---

## 6. Data format — separate plugin versions from the core schema

### Design decision

Keep the main miniCycle document under the existing `schemaVersion: "2.6"` contract unless a separately justified core migration is required. **Do not** invent per-install `2.6-task-timer` schema variants or add unvalidated fields to task objects that the `.mcyc` importer may drop.

Use a **namespaced plugin data store**, preferably through a shared storage service backed by IndexedDB when suitable for growing session history. The storage service may serialize/backup plugin payloads separately from the core AppState. Avoid each plugin independently managing arbitrary `localStorage` keys.

Each plugin has a separate `dataVersion` and a migration path. `installed/enabled` are installation settings; `requestedEnabled` in a backup is a preference that can be deferred if code is unavailable.

### Illustrative portable full-backup envelope

This **extends** miniCycle's existing `{ schemaVersion, miniCycleData, backupMetadata, liteStorage? }` style; it is not an existing production format:

```json
{
  "schemaVersion": "2.6",
  "miniCycleData": "{... existing serialized miniCycle document ...}",
  "backupMetadata": { "source": "miniCycle App", "createdAt": 1793923200000 },
  "pluginManifest": {
    "formatVersion": 1,
    "plugins": [
      {
        "id": "taskTimer",
        "lastUsedPluginVersion": "1.0.0",
        "dataVersion": 1,
        "requestedEnabled": true,
        "enabledRoutineIds": ["routine-example"]
      }
    ]
  },
  "pluginData": {
    "taskTimer": {
      "dataVersion": 1,
      "sessions": [
        {
          "id": "segment-example",
          "routineId": "routine-example",
          "taskId": "task-example",
          "startedAt": 1793923200000,
          "endedAt": 1793923325000,
          "elapsedMs": 125000,
          "endReason": "task_completed"
        }
      ]
    }
  }
}
```

**Notes:** The root `schemaVersion` continues to describe the *core* document; `dataVersion` describes one plugin's records. Times and ids above are examples. Routine-level sessions and currently running session checkpoints would need their own explicit structures, not be inferred solely from task segments. Backups carry **data and metadata, never executable plugin code**.

**Storage safety:** Validate IDs/types/sizes/depth; defend against unsafe keys and prototype pollution; cap/summarize only UI rendering, **not the user's original saved data**. Use indexed retrieval or pagination for long histories. The current file restore accepts at most roughly 10 MB of input; assess how session accumulation affects that limit and update it responsibly before launch. Never truncate historical records silently just to fit a backup.

### Import / export distinction

- **Full installation backup:** Includes all plugin metadata, sessions, pending data, and compatible versions.
- **Individual `.mcyc` routine export:** Existing importer copies a fixed task field set. For v1, **do not imply routine exports include plugin history**. Either keep them explicitly core-only with a clear UI explanation, or design an explicit, versioned per-routine plugin export format in a separate phase.
- **Rescue-screen export:** Must preserve plugin data through the format normalization path, even if a plugin cannot be loaded.
- **Automatic/manual/session backups:** Must retain plugin data even when the related plugin is disabled or unavailable.

---

## 7. Backup and offline restore — required behavior

### Preflight (before changing live data)

1. Parse and normalize the existing Settings, BackupManager, or rescue-screen backup shape.
2. Validate core document compatibility and the optional plugin manifest/data envelope **without executing plugin code**.
3. List detected plugins and categorize them as **installed/compatible**, **bundled but not enabled**, **downloadable but not present**, **offline/unavailable**, **incompatible**, or **unknown**.
4. Explain what can be restored now. Offer **Restore routines and preserve plugin data** as the safe default; never block core restore waiting for a plugin or network.
5. Create a **pre-restore safety backup that includes both core and plugin data**. If that fails, use the existing explicit warning/confirmation pattern.
6. Stage validated core and plugin data before committing; keep a recovery marker/rollback plan for interrupted multi-store writes. **`localStorage` + IndexedDB are not one atomic transaction**—do not describe them as such or rely on a fictitious all-or-nothing commit.
7. Restore core data and store each plugin namespace, including unknown/unavailable ones, safely and persistently.
8. Reinitialize core UI; only then activate compatible, trusted plugin code and apply plugin-owned migrations in a guarded step.
9. Show a precise result: **Core restored**, **Task Timer restored**, or **Task Timer data preserved; plugin not active**. Do not falsely claim complete success on a partial write.

### Offline and missing-plugin behavior

| Situation | Expected result |
| --- | --- |
| Offline; plugin already bundled/cached and compatible | Restore and activate without network |
| Offline; plugin code missing | Restore core, preserve payload, show “Install when available”; no network dependency |
| Plugin disabled on current install | Preserve history; offer enable; do not activate automatically without agreed policy |
| Unknown plugin ID in backup | Keep namespace opaque and inert; never execute it or discard it |
| Installed plugin older than backup's data version | Preserve payload; do not run unsafe downgrade; show incompatible/pending status |
| Installed plugin newer than backup's data version | Run tested forward migration **on a copy**, then commit on success; preserve original on failure |
| Online but catalog/install fails | Core restore remains usable; data stays pending; offer retry later |
| User later installs compatible plugin | Discover saved namespace and offer data recovery/activation without importing the backup again |
| User backs up while plugin is still missing | **Preserve that missing plugin's original data and manifest in the new backup** |

**Never automatically install untrusted code based on a backup.** Any future remote installer must obtain code through a trusted allowlisted catalog/integrity checks and user approval. For a bundled v1 plugin, no download need exist at all.

### Important restore edge cases

- Old backups with **no** `pluginManifest`/`pluginData` must still restore normally. Do not infer that absence means the user intentionally asked to wipe separately stored plugin history; preserve or archive current plugin data according to a documented full-restore policy.
- When restoring data for the **same plugin** already on the device, do not blindly concatenate histories. Choose clear **replace-with-backup** semantics with safety snapshot, or implement an explicitly deduplicated import mode. Do not silently merge.
- Plugin records for routines/tasks that are missing in the restored core document stay as **orphaned preserved history**, not deleted. The UI may show “Original task unavailable.”
- If a plugin migration fails, quarantine/preserve its pre-migration payload; core routines remain available.
- Factory reset should offer an explicit choice or clear warning about deleting plugin data. A user-requested full data wipe is distinct from disabling or uninstalling a plugin.
- Plugin-data restoration may add to file size and storage quota; test quota failures, corrupted payloads, and interrupted restores before release.
- The *next* backup must include **all stored plugin namespaces**, not merely those for loaded plugins. This is a release-blocking invariant.

### Representative restore UI text

> **Task Timer data found**  
> This backup includes timing history, but the Task Timer plugin isn't currently available. Your routines can be restored now. We'll keep the timing history safely so you can use it when a compatible plugin is available.

Button choices: **Restore now** / **Cancel**. When appropriate, offer **Enable Task Timer** separately. An online download is **never** a prerequisite for restoring routines.

---

## 8. Integration order / delivery milestones

Implement in this order to avoid a partial installation UI that promises backups or timing behavior the app cannot yet protect.

### Milestone A — Contracts and test scaffolding (no user-visible changes)

- [ ] Reinspect relevant modules and lifecycle paths against the current branch.
- [ ] Define plugin IDs, compatibility rules, enable/disable behavior, `dataVersion`, API boundaries, storage interface, and event payloads.
- [ ] Document timer state machine and reset/undo/switch policies; decide open questions below.
- [ ] Write failure-path tests for plugin manager event dispatch, registration idempotency, and unload cleanup.
- [ ] Prove the core app behaves identically when no plugin is installed.

**Gate:** Plugin subsystem can register a harmless test plugin on demand, disable it, and clean up all listeners without modifying routine data.

### Milestone B — Plugin-owned persistence + recoverable backups (before timer launch)

- [ ] Add versioned namespaced plugin storage with a documented backup snapshot API.
- [ ] Extend Settings backup creation and restore (`backupRestoreManager.js`).
- [ ] Extend IndexedDB backups and portable export (`backupManager.js`).
- [ ] Extend rescue-screen export/normalization (`orchestrator.js` / `backupRestoreManager.js`).
- [ ] Preserve unknown namespaces, disabled-plugin data and orphaned data through restore-and-rebackup.
- [ ] Stage writes with rollback/recovery strategy; test quota/partial failure; maintain old backup support.
- [ ] Verify portable backups on web/PWA and native/mobile wrappers where applicable.

**Gate:** A backup containing fake missing-plugin data restores offline, retains all core routines, and exports a new backup with the fake plugin data unchanged.

### Milestone C — Real plugin integration + Task Options UI

- [ ] Add a trusted first-party plugin registry/activation path to the deferred loader and DI manifest.
- [ ] Connect task completion/reset/deletion/switch events to plugins with deterministic ordering and no duplicate dispatch.
- [ ] Add plugin-supplied task button definitions to `taskButtons.js`; support icon, label, pressed state and accessibility.
- [ ] Add **Task Button Plugins → Task Timer → Add/Enable** to `taskOptionsCustomizer.js`.
- [ ] Persist installation state separately from per-routine button visibility.
- [ ] Verify plugin disabled/uninstalled returns UI to its previous form without deleting data.

**Gate:** User enables and disables a test plugin from the customizer with no altered behavior in non-enabled routines.

### Milestone D — Implement Task Timer v1

- [ ] Refactor/reuse the existing example tracker where beneficial; remove floating hard-coded demo UI.
- [ ] Implement routine and task timing state machines, start/pause/stop/completion transitions, and one-active-task rule.
- [ ] Implement persistent running checkpoints, idempotent closed segments, compact routine footer, and simple history display.
- [ ] Define and test auto-reset, manual reset, Complete All, task deletion, routine switching and plugin disable.
- [ ] Handle background/foreground, reload/crash recovery, accessibility, focus mode, and re-render.
- [ ] Wire versioned timer data into common backup storage and optional forward migrations.

**Gate:** Timer works end-to-end without any new mandatory configuration and survives backup/restore, including offline recovery.

### Milestone E — Release hardening and small beta

- [ ] Exercise all supported environments and distribution targets; verify offline module availability when bundled.
- [ ] Run `cd web && npm run build:chrome-full`; inspect the generated MV3 package and test first-party plugin enable/disable, timing, side-panel closure/reopen, and restore offline.
- [ ] Check generated extension for unexpected remote scripts, inline JavaScript, `eval`/code-string execution, new permissions, missing plugin assets, and build drift.
- [ ] Keep Lite (`chrome/lite/`) explicitly out of scope unless a separate Lite-specific design is approved; do not assume the full build updates Lite.
- [ ] Run existing `basicPluginSystem`, `taskOptionsCustomizer`, task lifecycle, backup, migration, accessibility and journey tests plus new tests.
- [ ] Test with volunteers, including the users who asked for timing if contact is available/appropriate.
- [ ] Review storage growth and actual UX confusion; fix only high-impact issues.
- [ ] Update user manual, data schema documentation, release notes and future-work status.
- [ ] Explicitly mark Task Timer v1 **complete** and resume priority on Task Cycle.

---

## 9. Chrome extension compatibility — packaged, optional first-party plugins

**Target for v1:** The **full** Chrome/Chromium side-panel extension (`chrome/full/`), not the separate Lite popup (`chrome/lite/`). The full extension is built from the canonical `web/` source using `cd web && npm run build:chrome-full` (see `chrome/README.md` and `web/scripts/build-chrome-full.cjs`). Its current generated files already include `basicPluginSystem.js` and `exampleTimeTrackerPlugin.js`, but their presence **does not mean the timer is currently wired or enabled**.

### Distribution rule: installed by the user, packaged by the developer

- The full extension uses **Manifest V3**. For a Chrome Web Store-distributed extension, operational plugin JavaScript must be **inside the submitted/reviewed extension package**, rather than downloaded and executed afterward. The standard extension-page CSP also disallows arbitrary remote scripts, inline JS, and string-to-code execution. See the official [MV3 additional requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements) and [extension CSP guidance](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).
- **Approved v1 model:** Bundle a trusted Task Timer module with the extension; register it in a first-party catalog; leave it dormant until the user chooses **Add/Enable** in Task Options; allow independent **per-routine** button visibility. This is an in-app feature activation, **not a Chrome extension installation** and not a new Web Store permission grant.
- A future remote catalog may deliver descriptive metadata or non-executable configuration **only when all feature logic is packaged**. Do not load remote `.js`/WASM, call `eval`/`new Function`, treat downloaded strings as executable commands, or introduce a generic code interpreter to bypass MV3 review.
- Chrome extension updates deliver new plugin **code versions**. In-app toggles control which packaged capabilities users activate; they cannot install arbitrary new code from a server. Review relevant Chrome policies again before introducing any different plugin distribution model.

### One source, two builds; Lite stays separate

1. Author timer state machine, storage contract, UI integration, events and tests in `web/`. Avoid a second copy of the feature in `chrome/full/`.
2. Run `cd web && npm run build:chrome-full`; verify the generated extension includes all required plugin modules/assets and that dynamic imports resolve to packaged local resources under its CSP.
3. Test the **full side-panel** UX, including narrow widths, page/side-panel transitions, "Open in full tab," focus and keyboard navigation, and routine timing while the panel is closed and reopened. Persist timestamps/checkpoints rather than depending on continuously firing intervals.
4. Verify the plugin can be enabled and used **fully offline** once the extension package is installed. An extension-local bundled module must not depend on a web-app service worker or network fetch.
5. Keep `chrome/lite/` explicitly **out of v1 scope**. It is an independently maintained Lite popup, not generated from full web source; copying full plugins into Lite would be a separate product and engineering decision.
6. Avoid adding `chrome.storage`, `alarms`, host permissions or background features *unless an actual tested requirement justifies them*. The current full extension uses extension-local web storage and has its own MV3 service worker for side-panel setup; don't assume that background worker can run a timer continuously.

### Chrome-specific backup and data semantics

- **Full backups remain portable across supported web/PWA and full-extension installations**, provided core and plugin data versions are compatible and the restore explicitly supports the envelope. Use the same plugin IDs, data versions, and migration rules on both platforms.
- The web app (`https://minicycle.app`) and the extension (`chrome-extension://...`) have **separate storage origins**. Enabling Task Timer in both places does **not** synchronize timing history; a supported backup/restore transfer can move data, but automatic sync is outside this initiative.
- When restoring offline into the full extension, a **bundled compatible** plugin may be activated without a download after user confirmation. If the installed extension build does not include a compatible plugin, restore routines first and **preserve its plugin data inertly** for a future extension update. Preserve pending plugin history in *subsequent* extension backups too.
- Verify that the full extension's file import/export workflow works from the side panel and full tab without relying on PWA service-worker behavior. Keep older pre-plugin backup files compatible and preserve unknown namespaces.
- A backup can **suggest a required plugin**, but must never execute code, bypass the first-party registry, or silently alter extension permissions.

### Chrome-specific acceptance checks

| Check | Required result |
| --- | --- |
| Rebuild full extension from `web/` | Packaged plugin code/assets present; no manual drift or missing import |
| Chrome MV3 review/CSP | No remotely hosted executable logic, inline scripts, `eval`, or unexpected permissions |
| Fresh full-extension install | Timer absent from task UI until enabled; existing routines work unchanged |
| Enable bundled timer with network disabled | Successful activation; task option and footer work offline |
| Close/reopen side panel or open full-tab view | Persisted elapsed time and end-reason history follow the defined interruption policy |
| Export from web/PWA, restore in full extension | Core data and compatible timer history restored without silent loss |
| Restore with plugin data but missing plugin code | Core succeeds, plugin history preserved pending future update; rebackup retains history |
| Existing Chrome Lite popup | No unexpected behavior or scope expansion |

**Release gate:** Do not advertise Task Timer as supported in the full Chrome extension until a generated MV3 build passes these checks. Chrome support is a **platform validation step for the shared feature**, not a separate plugin framework or marketplace.

### 9a. The other builds made from `web/`

The iOS and Android apps (Capacitor, `mobile/`) and the desktop app (Electron, `desktop/`) are built from the same `web/` source as the Chrome extension, by the same release script (`update-version.sh --ios --android --desktop`). They get the plugin code automatically, so they are **in scope by default** and need the same checks before the feature is called supported there:

- **Activation offline:** enabling the bundled plugin works with no network on each (all three already boot offline from a packaged payload).
- **Lifecycle:** timing survives what each platform does to a running app — iOS/Android backgrounding and process kill (the WKWebView / Android WebView is suspended, so no interval runs), desktop window close and reopen. Same rule as Chrome: persisted timestamps are the truth, never a running interval.
- **Storage and backups:** each app has its own storage (iOS `capacitor://localhost`, Android `https://localhost`, desktop `app://minicycle`), separate from the web app and from each other. Backups move timer data between them; nothing syncs.
- **WebKit:** the iOS app is a WKWebView. Run `npm run test:webkit` and `npm run test:journey:webkit` for the timer before an iOS release.

If one of these is held back from v1, say so in this section and hide the plugin there (a platform check in the plugin catalog), rather than shipping it untested.

---

## 10. Acceptance test matrix (release blockers)

| Test | Expected result |
| --- | --- |
| No plugin installed | miniCycle boots and behaves exactly as before; no timer UI |
| Install/enable while offline (bundled plugin) | No network needed; task option appears only for selected routine |
| Play Task A → pause | Routine continues, Task A segment closes once |
| Play Task A → Play Task B | A closes/pauses once, B runs, routine elapsed remains continuous |
| Complete running task | Task segment ends with `task_completed`; routine continues |
| Last-task completion triggers auto-reset | Timing closes in correct order; no missing/duplicate history; auto-reset still works |
| Complete All / manual reset | Active sessions close with correct end reason |
| Delete task while running | Task segment closes, history preserved with stable historical identifiers |
| Re-render task list / open completed dropdown | Timer state survives; no duplicate event listeners/buttons |
| App backgrounded or killed and reopened | Deterministic elapsed time and interruption policy; no tick-dependent loss |
| Disable plugin, then re-enable | UI disappears/reappears; timing history intact |
| Backup, uninstall/disable, restore | Timer history returns when plugin is compatible |
| Restore same backup offline on install without plugin | Core routines restored; timer payload remains pending and intact |
| Rebackup while plugin missing, restore on a compatible install | Timer payload survives round trip |
| Unknown plugin name in backup | No code is run; payload preserved; ordinary routines restored |
| Backup dataVersion newer than installed plugin | No unsafe downgrade; payload preserved; clear pending warning |
| Corrupt plugin section, valid core | Safe, explicit core-versus-plugin recovery behavior; no silent data loss |
| Corrupt core document | Rejected before replacing existing state |
| Storage quota / interrupted restore | Previous data/safety backup recoverable; no false success message |
| Old pre-plugin full backup | Restores as before; absence of plugin section handled safely |
| Import/export individual `.mcyc` routine | Ordinary task behavior intact; plugin-history support clearly documented rather than assumed |
| Keyboard/screen reader / three-dots / mobile | Play/Pause has correct focus, labels, pressed state and safe touch targets |
| Change system clock during a session | Elapsed handling follows documented policy; no absurd or negative duration saved |
| Full Chrome MV3 extension bundle | Timer code included locally; no remotely executed plugin code; activation works offline |
| Chrome side panel close/reopen | Timer and history recover according to documented interruption policy |
| Web backup restored in full extension | Core + compatible plugin data preserved; no cross-origin auto-sync assumed |
| iOS / Android / desktop app (§9a) | Same results as the web app; timing survives backgrounding, process kill and window close |
| Full-extension backup while plugin unavailable | Unknown/pending plugin data remains intact on rebackup |

**Automated tests should favor behavior and invariants over only implementation details:** same app behavior when disabled, no unintentional data loss, exactly-once session closure, and a real offline restore-and-rebackup round trip.

---

## 11. Decisions still to confirm before coding

These are **small product decisions**, not reasons to delay writing the tests or storage foundation:

1. **Routine switching:** Stop/pause active timers on switch (recommended v1) or allow timing to continue in background? Do not ship ambiguous behavior.
2. **Routine Stop vs Reset:** Stop ends the active routine session without clearing historical time; Reset is a distinct checklist lifecycle event, not a history deletion command.
3. **Interrupted sessions:** Resume a running checkpoint with user confirmation, or close it at last reliable timestamp and mark `interrupted`? Pick one clear default.
4. **Per-routine visibility:** Installing the plugin globally should not automatically add Play/Pause buttons to every existing routine. Recommended default: explicit per-routine opt-in.
5. **Disabled-plugin storage:** Keep it indefinitely by default, with explicit user-directed deletion; document any future storage management controls.
6. **Routine-only `.mcyc` files:** Keep core-only for v1, or add separately versioned scoped plugin exports later; never silently discard user data while claiming it is fully backed up.
7. **Timer history retention/display:** Keep full source records; offer paginated or summarized views, not automatic destructive pruning.
8. **Naming:** “Install” when a real download exists; “Add” or “Enable” for a first-party feature already included with the app. For the Chrome extension specifically, use “Add/Enable,” never imply it downloads executable plugin code.
9. **Chrome support:** Full generated MV3 extension is included in the shared v1 release gate; Lite remains a distinct, out-of-scope port unless decided otherwise.
10. **iOS, Android and desktop:** In scope by default because they share the code (§9a). Decide before Milestone E whether any is held back from v1.

---

## 12. Release criteria and deliberate stopping point

This feature is **done** when a user can enable Task Timer from an existing customization surface, time tasks and routines with minimal interaction, view simple reliable history, disable it without losing data, and restore **both** routines and timer records from backups **without internet or an installed timer plugin**. The generated **full Chrome extension** must also support bundled optional activation, offline timing, and compatible backups before Chrome support is announced. Non-users see no extra clutter and experience no regression in routine completion/reset.

After this, move further time-tracking features—structured inspection answers, notes linked to timed jobs, comparisons, deep analytics, reporting, sync, collaboration—into **Task Cycle**, where they fit the paid product's distinct purpose.

### Explicitly not required for v1

- Full plugin marketplace or remote plugin hosting
- Third-party script installation
- User-configurable timer goals, Pomodoro cycles, billing or timesheet export
- Rich performance dashboards or charts
- Team accounts, cloud sync or collaboration
- A new core schema version solely because a plugin is enabled
- Installing any plugin before restoring ordinary miniCycle data
- Remotely downloaded executable plugins inside the Chrome extension
- Adding Task Timer to the separately maintained Chrome Lite popup, or to the web Lite app (`lite/`)

---

## 13. Source references for future implementers

Unless otherwise indicated, paths refer to `web/` on `sparkinCreations/miniCycle`; follow the repository's actual web/Chrome/native build process and do not manually duplicate generated mirror files without checking how they are maintained.

- Plugin base / manager: [`modules/other/basicPluginSystem.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/other/basicPluginSystem.js)
- Prototype timer: [`modules/other/exampleTimeTrackerPlugin.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/other/exampleTimeTrackerPlugin.js)
- Integration notes: [`modules/other/pluginIntegrationGuide.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/other/pluginIntegrationGuide.js)
- Deferred boot manifest: [`modules/boot/moduleManifests.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/boot/moduleManifests.js)
- Task options UI: [`modules/ui/taskOptionsCustomizer.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/ui/taskOptionsCustomizer.js)
- Task buttons: [`modules/task/taskButtons.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/task/taskButtons.js)
- Task completion: [`modules/task/taskCompletion.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/task/taskCompletion.js)
- Routine reset: [`modules/task/taskCycleReset.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/task/taskCycleReset.js)
- File backup/restore: [`modules/ui/backupRestoreManager.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/ui/backupRestoreManager.js)
- IndexedDB backups/export: [`modules/storage/backupManager.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/storage/backupManager.js)
- Rescue backup: [`modules/boot/orchestrator.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/boot/orchestrator.js)
- Core version logic: [`modules/utils/schemaVersion.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/modules/utils/schemaVersion.js)
- Schema reference: [`docs/reference/SCHEMA_2_6.md`](https://github.com/sparkinCreations/miniCycle/blob/main/web/docs/reference/SCHEMA_2_6.md)
- Routine export/import schema: [`mcyc.schema.json`](https://github.com/sparkinCreations/miniCycle/blob/main/web/mcyc.schema.json)
- Existing plugin tests: [`tests/basicPluginSystem.tests.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/tests/basicPluginSystem.tests.js)
- Existing task-option tests: [`tests/taskOptionsCustomizer.tests.js`](https://github.com/sparkinCreations/miniCycle/blob/main/web/tests/taskOptionsCustomizer.tests.js)
- Chrome build and edition distinctions: [`chrome/README.md`](https://github.com/sparkinCreations/miniCycle/blob/main/chrome/README.md)
- Full extension build script: [`web/scripts/build-chrome-full.cjs`](https://github.com/sparkinCreations/miniCycle/blob/main/web/scripts/build-chrome-full.cjs)
- Current full MV3 manifest: [`chrome/full/manifest.json`](https://github.com/sparkinCreations/miniCycle/blob/main/chrome/full/manifest.json)
- Chrome MV3 remotely hosted code policy: [Chrome Web Store additional requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- Chrome extension CSP: [Chrome Developers reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)

**Final principle:** **A plugin may add capabilities and its own versioned data; it may not make ordinary miniCycle data unrecoverable.**
