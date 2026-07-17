# Bug: Undo/Redo rollback restores state but leaves the UI stale

**Module:** `web/modules/ui/undoRedoManager.js`
**Severity:** Medium — no data loss, but the app displays incorrect information the user cannot trust
**Status:** Unverified in production (see reproduction steps); confirmed by code inspection
**Affects:** Both `performStateBasedUndo()` and `performStateBasedRedo()` (symmetric bug)

---

## Summary

When an undo (or redo) operation throws partway through applying, the `catch`
block correctly rolls the application state back to a pre-operation snapshot,
but it does **not** re-render the task list. The result: the underlying data is
correct, but the screen continues to show the half-applied / stale visual state
until the next unrelated interaction forces a repaint.

The user sees an "Undo failed" notification, looks at a task list that doesn't
match reality, and has no reason to trust that their data is intact — even
though it is.

---

## Root cause

Both apply functions follow the same shape:

1. Snapshot a `rollbackState` via `structuredClone(AppState.get())` before mutating.
2. Apply the change inside a `try`.
3. On **success**, call `handleUndoRedoUIUpdate(...)`, which repaints the list
   (via `UIOrchestrator` or a fallback to `refreshUIFromState`), then
   `updateUndoRedoButtons()`.
4. On **failure**, the `catch` restores `AppState` from the snapshot, then calls
   **only** `updateUndoRedoButtons()`.

Step 4 is missing the repaint that step 3 performs. Restoring `AppState` updates
the data model but does not, on its own, redraw the DOM.

### Exact locations (line numbers as of review)

**Undo — `performStateBasedUndo()`** (starts ~line 1024)

- Success path repaints: `handleUndoRedoUIUpdate(...)` — **line 1133**
- Catch restores state: `await AppState.set(rollbackState)` — **line 1179**
- Catch repaint is absent; only `updateUndoRedoButtons()` — **line 1182**

**Redo — `performStateBasedRedo()`** (starts ~line 1207)

- Success path repaints: `handleUndoRedoUIUpdate(...)` — **line 1313**
- Catch restores state: `await AppState.set(rollbackState)` — **line 1359**
- Catch repaint is absent; only `updateUndoRedoButtons()` — **line 1362**

---

## Reproduction

The `catch` only runs if the apply path throws, which does not happen in normal
use. You must force a failure. Any one of the following methods works.

### Method 1 — Console injection (fastest, no code changes)

1. Open the app. Perform a few actions to build undo history (add tasks, check
   some off).
2. Open DevTools console and poison the update path so the next undo throws
   after the redo-stack push but during apply:

   ```js
   // Adjust to however AppState is reachable in your build.
   const s = window.AppState; // or your actual handle
   const realUpdate = s.update.bind(s);
   s.update = () => { throw new Error('forced undo failure'); };
   ```

3. Trigger undo (the undo button, or the keyboard shortcut).
4. **Observe:**
   - Expected (buggy) behavior: the "Undo failed" notification appears, but the
     task list still shows the pre-repaint / stale state.
   - Confirm the data is actually fine: run `AppState.get()` in the console (or
     reload the page). If a reload "fixes" the display, that proves only the
     render was stale — i.e. the bug is real.
5. Restore normal behavior:

   ```js
   s.update = realUpdate;
   ```

### Method 2 — Temporary throw in source (most realistic failure point)

In `performStateBasedUndo()`, immediately after the redo-stack push and before
the `await AppState.update(...)` apply call, insert:

```js
if (window.__forceUndoFail) throw new Error('test rollback');
```

Then in the console:

```js
window.__forceUndoFail = true;
```

Trigger undo and observe as in Method 1. This throws at the exact point the
rollback is designed to cover (redo already pushed, new state not yet applied).
Remove the injected line when finished.

### Method 3 — Regression test (permanent guard)

Add a case to `web/tests/undoRedoManager.tests.js`:

1. Inject an `AppState.update` (or `.set`) stub that throws.
2. Pass a **spy** for `refreshUIFromState` (and/or the `UIOrchestrator` update
   entry point used by `handleUndoRedoUIUpdate`).
3. Call `performStateBasedUndo()`.
4. Assert **both**:
   - State equals the `rollbackState` snapshot after the failure. *(Likely
     already passes.)*
   - The UI-refresh spy was called during the catch path. **This is the
     assertion that currently fails and reproduces the bug.**

Repeat for `performStateBasedRedo()`.

---

## Confirmation checklist

The bug is confirmed if, after a forced-failure undo/redo:

- [ ] The "failed" notification fires (the catch block ran).
- [ ] `AppState.get()` returns the correct pre-operation state (data is intact).
- [ ] The rendered task list does **not** match `AppState.get()` (screen is stale).
- [ ] A page reload makes the display correct again (only the render was stale).

---

## Suggested fix

In each catch block, after restoring state, call the same repaint the success
path uses. Conceptually:

```js
} catch (e) {
  try {
    await _deps.AppState.set(rollbackState);
    // Restore the undo/redo stacks (already handled here) ...

    // ADD: repaint from the restored state, mirroring the success path.
    handleUndoRedoUIUpdate(null, _deps.AppState.get());
    // or, if a diff isn't available here:
    // _deps.refreshUIFromState(_deps.AppState.get());

    updateUndoRedoButtons();
  } catch (rollbackError) {
    // existing rollback-failure handling
  }
}
```

Notes:
- `handleUndoRedoUIUpdate` already falls back to `refreshUIFromState` when no
  `UIOrchestrator` is present, so it is the natural single call to reuse.
- Apply the identical change to **both** `performStateBasedUndo()` (~line 1182)
  and `performStateBasedRedo()` (~line 1362) — the bug is symmetric and fixing
  only one leaves the other exposed.
- After fixing, the Method 3 regression test should go green.

---

## Why this matters

The undo engine is otherwise well built — it uses a transactional snapshot,
restores both operation stacks on failure, and has a grace-period guard against
async re-renders clobbering the redo stack. This UI-refresh gap is the one seam
where an otherwise-correct rollback still leaves the user looking at wrong
information, which undermines confidence in the exact feature (undo) whose whole
job is to make the user feel safe experimenting.
