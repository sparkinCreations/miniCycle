# Dev-build `validateTask()` enforcement

> **Status:** Idea — not scheduled. Split out of `SCHEMA_2_6_PLAN.md`'s
> *Future considerations* on Nov 5 2026, when that plan was archived (docs
> audit round 0); it is the only part of that plan that was not shipped.
> **Last verified:** Nov 5 2026

## The idea

Route task creation through `DataValidator.validateTask()`
(`modules/utils/dataValidator.js`) in dev builds, so a field default that
drifts from the schema is caught where the object is born, not later when the
data is read back.

## Why

The `highPriority: null` bug (fixed v2.398; postmortem in
[`archive/HIGH_PRIORITY_NULL_DEFAULT_FIX.md`](../archive/HIGH_PRIORITY_NULL_DEFAULT_FIX.md))
shipped because one creation path defaulted a field differently from the
schema. Nothing checked new tasks against the schema at the moment they were
made, so the mismatch only surfaced downstream.

Schema 2.6 changed the shape (priority is a level, `autoClear` is one per-mode
map) but not this gap. The validator point still stands whatever shape a field
takes.

## What is true today (checked Nov 5 2026)

`validateTask()` runs on two paths only: `.mcyc` import
(`ui/cycleImportManager.js`) and routine-level validation inside
`dataValidator.js` itself. Task creation does not call it.

## Open questions

- Which creation paths count: user add, recurring spawn
  (`recurring/recurringWatcher.js`), import, undo restore, repair?
- How a dev build is detected without adding a `window.*` flag (CLAUDE.md
  forbids new globals), and that the check is off in the `web/dist/` bundle.
- Whether a failure should throw (dev only) or log through the same
  starved-dependency style warning the real-app test runners already fail on.
