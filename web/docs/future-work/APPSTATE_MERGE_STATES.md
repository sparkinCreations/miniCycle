# AppState — implement `mergeStates()` for concurrent-modification conflicts

**Status:** Deferred (not scheduled) · **Raised:** 2026-07-26 · **Supersedes target:** ADR-011's last-write-wins default

## Context

`AppState.save()` detects when another context (another tab, or a reload race) persisted newer
data while this context still held unsaved changes. As of **v2.330** that path is **last-write-wins
+ notify**: it adopts the stored data, warns the user, and notifies subscribers so the UI redraws
honestly (see **ADR-011**). That fixed the real bug — the old code discarded silently *and* left
the UI rendering ghost edits (drift-review v2 §1.1). Since then (current as of **v2.412+**) the
detection itself was hardened: the primary discriminator is now `isForeignWrite` — a per-tab
identity stamp (`storedData.metadata.lastModifiedBy !== this._tabId`) — with the timestamp-diff
threshold (`diff > DEBOUNCE.CONCURRENT_MOD_CONFLICT`) kept only as a fallback for stored data
without the stamp.

What last-write-wins does **not** do: preserve the losing context's unsaved edits. Those are still
dropped — now announced, not silent. The 2025 AppState spec
(`archive/CODE_REVIEW_FINDINGS_2025.md`) originally sketched a **merge** here
(`this.data = this.mergeStates(current, this.data)`), but `mergeStates()` was never implemented
(`grep mergeStates modules/` → 0). This doc is that deferred upgrade.

## What "done" would look like

Replace the last-write-wins branch in `save()` — the `isForeignWrite` branch (`appState.js`
~:730-768; the timestamp-diff comparison is now only its fallback) — with a real merge that
preserves both contexts' non-conflicting changes, then still notifies subscribers + warns only on
true field-level collisions. Note the branch already runs a
`validateSchema25Structure(storedData)` pre-check before adopting stored data — any merge result
must clear at least that same bar.

## Why it's hard (and why it's deferred, not done)

Merging two divergent full-state trees safely is the whole problem — a wrong merge corrupts
silently, which is worse than an announced discard. The shape to work through:

- **Granularity.** Whole-record LWW is what we have. Useful merge is per-cycle, then per-task, then
  per-field (completion state, text, priority, recurring template, order).
- **Ordering.** `tasks[]` is an ordered array. Two contexts reordering the same list is a genuine
  conflict with no obviously-correct resolution — needs a rule (e.g. stable-id + one side wins
  order, other side's field edits merge in).
- **Deletions vs. edits.** Context A deletes a task, context B edits it — delete-wins or edit-wins
  must be a stated rule, not an accident.
- **Schema surface.** `recurringTemplates[]`, `clearedTasks`, `cycleCount`, `history[]`, and
  `settings` each need a merge rule or an explicit "LWW is fine for this subtree" note.
- **Validation.** Any merged result must pass the same schema/`validateRecoveredData`-style checks
  the salvage path uses before it's adopted, or we've just built a new corruption source.

A CRDT-style model would make this principled but is a large dependency-free build against ADR-001.

## Trigger to revisit

Single-user usage makes same-routine concurrent editing rare, so this sits until one of:

- Multi-device or heavy multi-tab concurrent editing becomes a real usage pattern.
- Users report lost edits after the "your changes were superseded" warning (i.e. announced loss
  starts actually hurting people).
- A schema change (e.g. Schema 2.6) revisits the state shape and merge becomes cheaper to add.

Until then, ADR-011's last-write-wins + notify is the accepted behavior.

## Pointers

- Decision of record: `ARCHITECTURE_DECISIONS.md` **ADR-011**
- The fix that made loss honest: v2.330, `appState.js` conflict path + the storage-event handler it mirrors
- Origin of the finding: `archive/miniCycle-drift-review-v2.md` §1.1 (correction folded in at archive time, Aug 2026)
