# What's New in miniCycle

*Draft — user-facing release notes for the v2.363 release. Review before publishing.*

This update focuses on reliability: the Complete button, Undo, and recurring
schedules all behave correctly now. Nothing about your routines or saved data
changes — just install the update and you're set.

## Fixed

- **The Complete button works again.** In Auto-Cycle and Manual modes, tapping
  "Complete Cycle" now completes and resets your tasks as expected. (It had
  stopped responding in these modes in a recent update.)

- **Undo is reliable again.** Undo now reverts exactly one action, every time:
  - Undo right after **adding a task** removes that task.
  - Undo after **completing a cycle**, using **Complete All**, or **Clear
    Completed** reverts the whole action in a single press — no more pressing
    Undo and seeing nothing happen, or landing on an unexpected earlier state.

- **Daily auto-reset stays out of your way.** When a routine auto-unchecks on
  its daily schedule, that no longer clogs your Undo history — Undo stays
  focused on the actions *you* took.

## Under the hood

- Task completion is now saved the instant it happens, so what's on your screen
  and what's saved never drift apart — even if you close the app mid-action.

---

*If anything with completing cycles or undo doesn't behave as you'd expect
after updating, let us know — this release reworked that area and real-world
feedback helps.*
