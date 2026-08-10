# `highPriority: null` on Newly Created Tasks — Fix Plan

> **Status:** ✅ SHIPPED in v2.398 (Aug 2026) · **Severity:** was Low-impact, high-noise ·
> **Found:** Aug 2026, live production review of `minicycle.app` (v2.396) by driving the real
> app in a browser.
>
> **Fixed in two places:** `taskCRUD.js` `addTaskImpl` now defaults `highPriority = false`
> (was `null`), and `taskUtils.js` `createOrUpdateTaskData` coerces with `highPriority || false`
> at the write site so any caller passing null/undefined still persists a boolean.
>
> **Verified live at v2.398:** a task created with the fixed code persists
> `highPriority: false` (type `boolean`) and produces **no** repair warning on the next boot,
> while a task created moments earlier with the pre-fix code still warned and was repaired.
> `priorityColor` is unchanged — `null` and `false` are both falsy, so the colour expression
> resolves identically; regression tests pin all four colour cases. The `.mcyc` import path
> was untouched: it builds tasks with its own code and never calls the creation path.
>
> The original finding, for the record: every task created through the UI was persisted with
> `highPriority: null` instead of `false`. Nothing broke visually — the value is
> truthiness-checked everywhere — but it was **schema-invalid per the project's own
> validator**, and forced a repair-and-rewrite of the routine on the next boot.

---

## Symptom

On every boot after a task has been added, the console logs one warning per affected task:

```
⚠️ Repaired task with invalid highPriority field: id-1786194802853-z92fm1198
```

The id in that warning is the task the user created in the previous session.

## Reproduction (verified on production, v2.396)

1. Add a task through the normal Add-task input.
2. Read it straight out of storage before any reload:

```js
const d = JSON.parse(localStorage.getItem('miniCycleData'));
const t = Object.values(d.data.cycles)[0].tasks.find(x => x.text === 'probe-task-abc');
({ hp: t.highPriority, type: typeof t.highPriority })
// → { hp: null, type: "object" }
```

3. Reload. `routineLoader` logs the repair warning for that id and rewrites the field to `false`.

The repair is durable — post-repair state is clean — so the defect re-appears once per newly
created task, not permanently.

## Why `false` is the correct default

Not a judgement call; the codebase already answers it three ways.

**1. The schema validator rejects non-boolean.** [`dataValidator.js:207`](../../modules/utils/dataValidator.js)
throws rather than coerces:

```js
if ('highPriority' in task && typeof task.highPriority !== 'boolean') {
    throw new TypeError('Task highPriority must be a boolean');
}
```

`null` survives only because the load path repairs it before the validator ever sees it.
Two other repair sites do the same coercion: [`routineLoader.js:264`](../../modules/routine/routineLoader.js)
and [`routineSwitcher.js:1296`](../../modules/routine/routineSwitcher.js).

**2. `null` is never read as distinct from `false`.** Every consumer coerces —
`if (task.highPriority)`, `task.highPriority === true`, `!!highPriority`, `|| false`. The
"(null uses default)" note in the `taskCRUD` JSDoc describes behavior that was never implemented;
there is no per-routine or per-app default priority to fall back to.

**3. Every other creation path already writes `false`.** `taskUtils.js:323` (recurring template),
`migrationManager.js:443`, `mcycPayload.js:52`, `cycleImportManager.js:654`,
`taskCycleReset.js:647`, `recurringActivation.js:99`. Both canonical shape docs —
[`types.js:23`](../../modules/core/types.js) and [`taskCore.js:32`](../../modules/task/taskCore.js) —
declare `[highPriority=false]`. `taskCRUD` is the sole outlier.

## Root cause

The correct normalization sits sixteen lines below the broken one, inside the same function
(`createOrUpdateTaskData` in [`taskUtils.js`](../../modules/task/taskUtils.js)):

```js
existingTask = {
    …
    highPriority,                                   // ← :307  raw — null flows straight through
    priorityColor: priorityColor || (highPriority ? COLORS.PRIORITY_DEFAULT : null),
    …
};

const templateData = (recurring && recurringSettings) ? {
    …
    highPriority: highPriority || false,            // ← :323  correct
    priorityColor: priorityColor || (highPriority ? COLORS.PRIORITY_DEFAULT : null),
    …
} : null;
```

The `null` originates upstream as the destructuring default in
[`taskCRUD.js:206`](../../modules/task/taskCRUD.js) (`highPriority = null`) and is threaded through
`loadTaskContext` unchanged.

## Fix

Three edits. Line numbers are as of Aug 2026 (v2.396) — verify before applying.

| # | File | Change |
|---|------|--------|
| 1 | `modules/task/taskUtils.js:307` | `highPriority,` → `highPriority: highPriority || false,` |
| 2 | `modules/task/taskCRUD.js:206` | `highPriority = null,` → `highPriority = false,` |
| 3 | `modules/task/taskCRUD.js:31` | JSDoc → `@property {boolean} [highPriority=false] - Priority flag` (drop `\|null` and the "(null uses default)" note) |

**Edit 1 is the load-bearing one.** It normalizes at the persistence boundary regardless of what
the caller passes, so an explicit `null` from any call site cannot reintroduce the bug. Edits 2
and 3 stop the declared contract from contradicting the validator, and bring `taskCRUD` in line
with `taskCore` and `types.js`.

`priorityColor` needs no change: it stays `null` for non-priority tasks, which is correct — the
loader's colour invariant (`routineLoader.js:271`) only applies when `highPriority` is truthy.

## Verification

- Add a task through the UI, read it from storage before reloading, assert
  `typeof task.highPriority === 'boolean'` and `=== false`.
- Reload and confirm no `⚠️ Repaired task with invalid highPriority field` warning appears.
- Regression guard: toggling priority on then off must land on boolean `false`, not `null`
  (`taskCRUD.js:842` already assigns a boolean, so this should already hold).
- Existing suites to re-run: `npm test` (taskCRUD / taskUtils), plus `npm run test:journey`
  for the add-task path.

## Why the gates missed it

No validation gate covers this. `dataValidator.js` would catch it, but it is not on the write
path — `createOrUpdateTaskData` commits through `AppState` without passing the new task through
it. The two modules each look correct in isolation: `taskCRUD` documents a nullable field and
honours its own doc, and `routineLoader` defensively repairs anything non-boolean. The
disagreement is only visible where they meet, at runtime.

Worth considering as a follow-up: routing task creation through `validateTask()` in dev builds
would have surfaced this at the moment of the write instead of one boot later.

## Related

- [`SCHEMA_2_6_PLAN.md`](SCHEMA_2_6_PLAN.md) — if the task shape is being revisited, fold this in
  and consider whether other optional task fields have the same writer/validator drift
  (`priorityColor`, `dueDate`, and `deleteWhenCompleteSettings` are all nullable in places).
