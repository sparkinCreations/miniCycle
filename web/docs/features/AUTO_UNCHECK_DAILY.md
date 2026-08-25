# Auto-Uncheck Daily

> **Added:** v2.206 (April 24, 2026)
> **Module:** [`web/modules/task/dailyResetManager.js`](../../modules/task/dailyResetManager.js)

A per-routine setting that unchecks all tasks at a configurable local time each day, **without** triggering a cycle completion. Designed for routines where you want a fresh slate at a fixed time (morning checklists, hygiene lists, end-of-day rituals) regardless of whether yesterday's tasks all got checked.

---

## Why It Exists

The existing cycle-completion auto-reset is event-driven: when the user finishes all tasks, the cycle completes (incrementing `cycleCount`, firing milestone/achievement hooks) and tasks reset for the next round. That model is great for "I run this routine N times a week" patterns.

But many users want a different model: **"I want this checklist to start blank every morning, even if I didn't finish everything yesterday."** The cycle-completion path doesn't fit because:

- It rewards all-tasks-checked behavior with a cycle increment, which we don't want for a soft daily reset.
- It only fires when the user actively completes the last task — never on a clock.

Auto-Uncheck Daily fills that gap with a clock-based, per-routine soft reset that is **completely independent** of the cycle accounting model.

---

## User-Facing Behavior

### Three UI surfaces

1. **Menu toggle** (in the Task Actions section, above "Uncheck All")
   - Checkbox: "Auto-uncheck daily"
   - When enabled, an inline pill-button appears showing the current time (e.g. `12:00 AM`) — tapping it opens the time picker modal.
2. **Status banner** (above the task list)
   - Subtle italic text: `🕛 All tasks auto-uncheck daily at 12:00 AM`
   - Centered, hit area limited to the text + icon (no full-width strip)
   - Tapping it opens the time picker modal — acts as both a status indicator and a quick-edit shortcut.
3. **Notifications**
   - On enable: `"Routine Name" auto-unchecks daily at 12:00 AM. (Won't complete a cycle.)` — with a **Change Time** action button.
   - On time change: `"Routine Name" auto-uncheck time updated to 6:30 AM`
   - On disable: `Auto-uncheck turned off for "Routine Name"`
   - On view-after-fire (per-routine, like reminders — see below): `"Routine Name" was auto-unchecked at 12:00 AM`

### Time picker modal

Native `<input type="time">` so mobile gets the OS picker (free a11y, dark/light handling). 24-hour input, 12-hour display.

### Multi-routine

Each routine has its own enabled/time setting. The watcher iterates **all** routines on each tick — switching routines after midnight will not reveal stale checked state on other routines that already had their resets fire.

---

## Notification Model — Per-Routine, Like Reminders

A naive design would fire a notification at the trigger time (e.g. midnight) for every routine that resets. With multiple routines all set to midnight, that's a stack of toasts no one is awake for.

Instead:

- **Fire-time:** completely silent unless the affected routine is currently being viewed. State updates atomically. No toast.
- **View-time:** when the user opens the app — or switches to a routine that had a reset fire since they last viewed it — a single toast surfaces: `"Routine Name" was auto-unchecked at 12:00 AM`.

This is implemented via a `pendingNotification` flag on the per-routine settings object. The flag is set to `true` when the reset fires for an inactive cycle, and cleared when the user views that cycle. For the active cycle, the flag is cleared immediately and the toast shown right away (the user is watching, no point in deferring).

---

## Schema

Per-cycle, under `state.data.cycles[cycleId]`:

```javascript
autoUncheckDaily: {
    enabled: false,            // user toggle
    hour: 0,                   // 0–23, local time
    minute: 0,                 // 0–59
    lastResetDate: null,       // 'YYYY-MM-DD' (local) — null = never fired
    pendingNotification: false // true after fire, cleared on view
}
```

The whole object is optional — a missing `autoUncheckDaily` field on a cycle means "not configured" (effectively disabled). All readers route through a `readSettings(cycle)` helper that returns safe defaults for missing fields.

---

## Implementation

### Module structure

**File:** [`web/modules/task/dailyResetManager.js`](../../modules/task/dailyResetManager.js)

DI-pure (uses `createDIModule()` from `diBase.js`). Exports a singleton `dailyResetManager` instance picked up by `moduleLoader.js` via the manifest's `provideInstance: 'dailyResetManager'`.

**Public API:**

| Method | Purpose |
|--------|---------|
| `init()` | Wire menu/banner UI, start ticker, subscribe to AppState, run initial check |
| `destroy()` | Tear down listeners, interval, AppState subscription (called on boot retry) |
| `checkAllRoutines()` | Iterate every cycle; fire reset for any whose trigger time has passed today and hasn't fired yet today |
| `setEnabled(cycleId, enabled)` | Toggle the per-cycle setting + show appropriate notification |
| `setTime(cycleId, hour, minute)` | Update the per-cycle time + clamped/validated |
| `openTimePickerModal(cycleId)` | Open the native `<input type="time">` modal |
| `showPendingNotificationIfAny(cycleId)` | View-time notification surfacing (used when user switches routines) |

### Ticking + catch-up

Self-contained scheduler (no coupling to `recurringWatcher.js`):

- **Adaptive `setInterval`** — `INTERVALS.DAILY_RESET_TICK` (30s) while **any** routine has the
  feature enabled, `INTERVALS.DAILY_RESET_TICK_IDLE` (2h) when none does. Covers the case where the
  app stays open across the trigger time. `_switchInterval()` re-evaluates on every AppState change
  and on `setEnabled()`, so enabling the feature returns an idle watcher to the fast rate
  immediately rather than after up to 2h. (Added Aug 2026, mirroring `recurringWatcher`.)
- **`visibilitychange` listener** — covers the closed-app case. When the tab becomes visible,
  `checkAllRoutines()` runs immediately and fires any missed resets. It also re-evaluates the tick
  rate, since another tab may have enabled the feature while this one slept.
- **Boot pass** — `init()` runs `checkAllRoutines()` once after wiring, so a reset that should have
  fired while the app was closed is caught the moment the user opens the app.

**The tick rate is a responsiveness knob, never a correctness one.** `checkAllRoutines()` asks an
INTERVAL question — *"have we passed today's trigger, and not yet reset?"* — which stays true until
midnight and is guarded by `lastResetDate`. Both the boot pass and the visibility handler run that
same check unconditionally. So the idle rate can delay a reset for a user sitting on an open tab; it
cannot lose one.

This is exactly where this feature differs from `recurringWatcher`, and why that module needs far
more machinery (15s cadence, oversleep detection, a separate timestamp-based catch-up): its pattern
gate asks whether *now MATCHES* the schedule, so a slow or frozen tick misses the matching minute
outright. Nothing here can miss a minute, because it is not looking for one.

### Idempotency

The fire path is keyed off `lastResetDate` (a local-time `YYYY-MM-DD` string). Same-day re-checks short-circuit. If a user changes the time to a future moment after today's fire already happened, `lastResetDate` is cleared so the new earlier-than-now / future trigger can fire today (only if the new time is actually in the future — past times don't re-fire same-day).

### Atomic update

The fire path mutates state via a single `AppState.update(producer, true)` call:

```javascript
this.deps.AppState.update(s => {
    for (const { cycleId, isActive } of fired) {
        const cycle = s.data.cycles[cycleId];
        if (!cycle) continue;
        if (Array.isArray(cycle.tasks)) {
            cycle.tasks.forEach(t => { t.completed = false; });
        }
        cycle.autoUncheckDaily = cycle.autoUncheckDaily || {};
        cycle.autoUncheckDaily.lastResetDate = today;
        cycle.autoUncheckDaily.pendingNotification = !isActive;
    }
}, true);
```

Tasks unchecked + reset date marked + pending flag set, all in one debounce-free producer.

### UI sync via `AppState.subscribe`

The menu controls + banner reflect the **active** routine's settings. When the user switches routines, the manager's AppState subscription detects the `activeCycleId` change and re-syncs:

- Toggle reflects the new routine's `enabled` state
- Time button label reflects the new routine's `hour`/`minute`
- Banner shows/hides based on the new routine's `enabled`
- Any pending notification for the new routine surfaces immediately

### DOM refresh after fire

For the active cycle, after the state update, the manager calls the canonical `loadMiniCycle()` (DI-injected via `optionalDeps`) to re-render the task list. This handles checkboxes, the `.completed` class, the completed-task dropdown, progress bar, overdue flags — everything a normal route load handles. Falls back to a minimal hand-rolled DOM patch if `loadMiniCycle` isn't wired (e.g. in tests).

---

## `.mcyc` Round-Trip

### Export

Both export paths include `autoUncheckDaily` in their whitelists:

- [`shareManager.js`](../../modules/ui/shareManager.js) — Share Routine flow
- [`cycleExportManager.js`](../../modules/ui/cycleExportManager.js) — menu Export flow

### Import

[`cycleImportManager.js`](../../modules/ui/cycleImportManager.js) sanitizes the imported field:

- **Preserves** `enabled`, `hour`, `minute` — these represent user intent that should transfer.
- **Resets** `lastResetDate` to `null` — the source machine's date context is meaningless on the importer.
- **Resets** `pendingNotification` to `false` — don't surface a "tasks were auto-unchecked" toast for a reset that happened on someone else's machine.

The sanitizer also clamps `hour` to 0–23 and `minute` to 0–59, defending against malformed `.mcyc` payloads.

---

## Coexistence with Cycle Auto-Reset

Both can be enabled on the same routine. They serve different triggers:

| Trigger | Cycle Auto-Reset | Auto-Uncheck Daily |
|---------|------------------|--------------------|
| User completes all tasks | Fires (cycleCount++) | No-op |
| Configured local time arrives | No-op | Fires (cycleCount unchanged) |
| Affects achievements/milestones | Yes | No |
| Plays cycle-complete animation | Yes | No |
| Notification | Cycle-complete toast | View-time toast |

The fire path explicitly does NOT call `incrementCycleCount`, `handleCycleCompletion`, `unlockThemeFromAchievement`, or any milestone hooks. It's pure state mutation + UI refresh.

---

## Testing

**File:** [`web/tests/dailyResetManager.tests.js`](../../tests/dailyResetManager.tests.js)

19 tests across:

- **Pure helpers** (`todayLocal`, `localTimeToday`, `formatTime12`, `formatTimeInput`, `readSettings`) — date math, edge cases (midnight, noon, padding)
- **Fire/idempotency logic** — disabled routines never fire, future-time routines wait, same-day re-checks short-circuit, multi-routine fires only the due ones
- **Active vs inactive split** — active cycle fires immediate notification + clears pending flag; inactive cycle defers via `pendingNotification`
- **View-time notification** — surfaces toast and clears flag when pending; silent when not pending
- **User actions** — `setEnabled` toggles + notifications, `setTime` clamps + future-clearing of `lastResetDate`
- **Defensive paths** — empty state tolerated, routines without `autoUncheckDaily` field ignored

Runnable in-browser via the testing modal (`/tests/module-test-suite.html`) or via Playwright.

---

## Edge Cases Handled

- **App closed all night** → `visibilitychange` on next open fires the catch-up pass
- **App open across midnight** → the 30s tick fires the reset within ~30s of the trigger time (or on the next visibility change / reload if the watcher happened to be at the idle rate, which can only be the case when no routine has the feature enabled)
- **Multi-tab open** → first tab to fire wins (atomic `lastResetDate` update); other tabs see same-day skip on next tick
- **DST transitions** → local `YYYY-MM-DD` avoids UTC bugs; reset fires once on the transition day at the configured local clock time
- **User changes time after today's fire** → if the new time is in the future, `lastResetDate` clears so it can fire again today; if past, no re-fire (prevents accidental immediate re-trigger)
- **Routine titled with HTML metacharacters** (e.g. `<script>`) → modal title escapes the name defensively before injection into `innerHTML`
- **Locked theme on imported routine** → unrelated to this feature; `autoUncheckDaily` round-trips regardless of theme state

---

## Files Touched (v2.206)

| File | Why |
|------|-----|
| [`web/modules/task/dailyResetManager.js`](../../modules/task/dailyResetManager.js) | New module |
| [`web/tests/dailyResetManager.tests.js`](../../tests/dailyResetManager.tests.js) | Tests |
| [`web/modules/labels/defaultLabels.js`](../../modules/labels/defaultLabels.js) | 16 new keys (menu, notify, banner, modal) |
| [`web/modules/core/constants.js`](../../modules/core/constants.js) | 5 new DOM_IDs |
| [`web/miniCycle.html`](../../miniCycle.html) | Menu toggle row + banner element |
| [`web/styles/components/menu.css`](../../styles/components/menu.css) | `.auto-uncheck-row` styling (spans grid full-width) |
| [`web/styles/components/task-list.css`](../../styles/components/task-list.css) | `.auto-uncheck-banner` styling (centered, subtle) |
| [`web/modules/ui/cycleImportManager.js`](../../modules/ui/cycleImportManager.js) | Sanitizer for `autoUncheckDaily` on import |
| [`web/modules/ui/cycleExportManager.js`](../../modules/ui/cycleExportManager.js) | Added field to export whitelist |
| [`web/modules/ui/shareManager.js`](../../modules/ui/shareManager.js) | Added field to share-export whitelist |
| [`web/modules/boot/moduleManifests.js`](../../modules/boot/moduleManifests.js) | Module registration in PHASE 4 (RECURRING) |
| [`web/tests/module-test-suite.html`](../../tests/module-test-suite.html) | Registered in in-browser test runner |

No CSP hash recompute — no inline `<script>` edits in `miniCycle.html`.

---

## Future Work

- **Notification batching** — if a user has 5+ routines all set to the same trigger time, the view-time toasts could batch into one ("3 routines reset for the day"). Skipped for v1; only worth doing if user feedback indicates it's noisy.
- **Per-routine notification mute** — `autoUncheckDaily.silentNotification: true` would let users disable the view-time toast for a specific routine. Trivial addition once the need surfaces.
- **Custom message** — currently the toast is fixed copy. Could be user-configurable per routine.
- **Tighter / looser tick** — `INTERVALS.DAILY_RESET_TICK` / `INTERVALS.DAILY_RESET_TICK_IDLE` in `constants.js` are the tuning knobs (the doc previously named a `TICK_INTERVAL_MS` module constant and a 60s value; neither has been accurate since the interval moved to `constants.js`). 30s is a reasonable middle for a once-per-day feature; tighten for responsiveness, loosen for battery.
