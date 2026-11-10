# Recurring Watcher — Startup and Interval Gaps

> **Status:** Open — 2 items, none started ·
> **Severity:** Low for both (a recurring task can appear late; nothing is lost) ·
> **Found:** Nov 2026, read-through of `recurringWatcher.js`, `recurringCalculators.js` and
> `recurringMatcher.js` at v2.675.
>
> Six things were raised in the review. Each was then checked; two are real and are listed
> below. The other four are recorded under "Reviewed, not issues" with the reason, so they
> are not raised again.

The recurring code is in good shape overall: the calculators handle clock changes in real
time, system spawns stay out of undo history, a spawn blocked by the task limit does not
consume its occurrence, one bad template cannot stop the rest, and catch-up runs on launch,
on returning to the tab and when a tick notices it overslept.

---

## 1. The watcher cannot start in a brand-new user's first session

**Reproduced** (headless Chromium, fresh browser context, v2.675).

`setupRecurringWatcher()` is called once, from `recurringIntegration.js` during boot. For a
new user `AppState.get()` is still `null` at that point, so it returns before it sets
`_recurringWatcherInitialized`, starts the interval or registers the `visibilitychange`
handler. Not running at boot is correct, since there is nothing to watch. The side effect is
the problem: `restartRecurringWatcher()`, which the activation and settings-applicator paths
call when a task is made recurring, returns immediately while that flag is false.

What the probe saw, reading `isWatcherInitialized()` on the live module instance:

| Point in the session | Initialized | Watcher interval |
|---|---|---|
| First launch, boot finished, choice screen up | false | none |
| After loading a sample routine | false | none |
| After calling `restartRecurringWatcher()` | false | none |
| After calling `watchRecurringTasks()` directly | false | started |
| Second launch (reload) | true | started |

**Why the impact is small:** `taskCompletion.js` and `taskCycleReset.js` call
`watchRecurringTasks()` directly, and that path does not check the flag, so the interval
starts the first time a recurring instance is completed or cleared. What stays missing until
the next launch is the catch-up on returning to the tab, which only setup registers; the
oversleep check in the tick covers most of that.

**To do:** either let `setupRecurringWatcher()` register the handler and set the flag when
there is no data yet (staying on the idle interval until a template exists), or have
`restartRecurringWatcher()` run setup when it has not happened. Pin it with a first-run
journey step: new user, make a task recurring, assert the watcher is initialized.

## 2. The interval can stay idle after switching routines

**From reading the code; not reproduced.**

`switchInterval()` is called from three places: `setupRecurringWatcher()` (boot),
`restartRecurringWatcher()` (a template is created) and `watchRecurringTasks()`. Loading a
routine (`routineLoader.js`) calls `catchUpMissedRecurringTasks()`, which is none of them. So if the app
booted on a routine with no recurring templates, the watcher is on
`INTERVALS.RECURRING_WATCHER_IDLE` (2 hours), and switching to a routine that has templates
leaves it there until something else calls the watch: a completion, a cycle reset, pull to
refresh or a return to the tab.

It needs a specific sequence to matter: boot on a routine without recurring tasks, switch to
one with them, the recurring task's instance is currently absent, and the app stays open in
the foreground with nothing completed or reset. A task that comes due in that window can
then appear up to two hours late.

**To do:** have catch-up call `switchInterval()` for the routine it just read, or have the
routine-load path call `watchRecurringTasks()` after catch-up.

---

## Reviewed, not issues

- **Two definitions of "due".** Catch-up spawns once `nextScheduledOccurrence` has passed;
  the 15-second watch also requires `shouldRecreateRecurringTask()` to match the current
  minute. This works because the oversleep check hands a late tick to catch-up. Having the
  watch trust the timestamp alone would be simpler, but that is a design preference, not a
  defect.
- **Matcher and calculator defaults differ for yearly settings.** The calculator reads
  `applyDaysToAll` and `useSpecificDays` as on unless false; the matcher reads them as
  truthy. Both run the settings through `normalizeRecurringSettings()` first, which always
  sets both to booleans, so the difference cannot be reached. Where the two still differ
  (yearly with no specific days: the calculator schedules the 1st, the matcher accepts any
  day that month) the timestamp gate makes the outcome the same.
- **`calculateNextOccurrence()` falls back to 24 hours on a calculation error**, and an
  unknown frequency is treated as daily. The code documents this as a choice to keep some
  schedule instead of throwing inside the spawn tick.
- **Some `watchRecurringTasks()` calls have no `catch`** (`restartRecurringWatcher()`, the
  `visibilitychange` handler, the call after a cycle reset). They can only reject when a
  dependency is missing, and an unhandled rejection still reaches the console.

Also worth knowing as behaviour: only the active routine's templates are watched, so a
recurring task in another routine appears when that routine is opened.

## Related

- [Recurring Tasks — P3 Follow-ups](RECURRING_TASKS_P3_FOLLOWUP.md)
- [Drag and Drop Hardening](DRAG_DROP_HARDENING.md)
- [Boot Orchestration Hardening](BOOT_ORCHESTRATION_HARDENING.md)
