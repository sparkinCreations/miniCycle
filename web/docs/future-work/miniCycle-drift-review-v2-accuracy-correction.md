## ⚠️ Accuracy Correction — July 25, 2026

This review was written after reading `docs/` and `legal/` but **before** reading `docs/archive/`
(108 files) or the `future-work/` completion lifecycle. Two findings changed on that basis. **Where this
block conflicts with the prose below, this block wins.**

Coverage at time of writing: roughly 8 documents of 340+. Treat §1–§2 as leads to verify, not conclusions.

---

### §1.1 — sharpened. The conflict discard is an unfinished spec, not a design choice.

The review framed this as drift against ADR-003's notify guarantee. That's true but understates it.

`archive/CODE_REVIEW_FINDINGS_2025.md:905-911` specifies the conflict path as a **merge**:

```js
if (current && current.metadata?.lastModified > this.data.metadata.lastModified) {
    console.warn('⚠️ Concurrent save detected, merging...');
    this.data = this.mergeStates(current, this.data);
}
```

What shipped (same doc, `:1057-1064`; still current at `appState.js:563-574`) is a **discard**:
`this.data = storedData`.

```
grep -rn "mergeStates" modules/ --include=*.js  →  0 results
```

`mergeStates()` was never implemented. So the discard is the placeholder branch that stayed, and it
additionally skips `notifyListeners()` — the same failure shape recorded in
`archive/BUG_undo-redo-rollback-ui-refresh.md` and cited in ADR-003's own Consequences.

**Revised framing:** an unimplemented piece of the 2025 AppState spec, which also breaks ADR-003's notify
guarantee. Two decisions available — implement `mergeStates()` as specified, or accept last-write-wins and
document it as a superseding decision. Either way, notify the user and subscribers.

Checked and *not* covered by: `CODE_AUDIT_5` (#5 is notify-before-save-completes, a different issue;
#6 listener cleanup is now fixed via `appState.js:898-918`), `HIDDEN_CODEBASE_INSIGHTS` §5.5 (detection
window, not post-detection behavior), `future-work/ERROR_HANDLING_PHASES_3_5.md` (atomicity, timeout
messages, error context).

---

### §2.3 — downgraded to a copy issue.

The salvage ladder is **completed work with recorded tradeoffs**, not an oversight.
`archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md` marks Phase 2 ✅ IMPLEMENTED (Jun 2026) and documents why
`dataRecovery.js` stayed pure/synchronous (AppState's load path runs before DI is wired and must not block
boot on a prompt) and why `extract-cycles` was dropped.

The remaining point is narrow: the disclosure copy. *"Some recent changes may be missing"* reads like a
lost checkbox; the measured behavior on a truncated 4-routine dataset was 2 routines lost. Suggest
quantifying (`"recovered 2 of 4 routines"`) and naming the `miniCycleData_corrupted_<ts>` key.

**Not an architecture finding. Reclassify as UX copy.**

---

### Survivors after checking archive + future-work

| Finding | Status |
|---|---|
| §1.2 `pagehide` missing from state layer | **Novel.** 0 hits across 232 docs + 108 archive files; `EVENT_LISTENER_AUDIT.md` has no unload coverage |
| §1.1 conflict discard | **Novel in current form**; partially yours as unimplemented `mergeStates` |
| §2.1 migration backups never pruned | **Novel.** 0 hits anywhere |
| §2.2 force-mode `backupResult` unchecked | Not yet checked against archive |
| §2.3 salvage disclosure | Downgraded — copy only |
| §1.3, §1.4 doc staleness | Unchanged |

---

### Note on §3

The "Already documented — not findings" table should be read as the main result of this review, not an
appendix to it. Extending it: `ERROR_HANDLING_IMPROVEMENTS_PLAN.md` (Phases 1–2 shipped, 3–5 carved out),
`CODE_AUDIT_5` #6 (listener cleanup, fixed), and the `future-work/ → implemented → archive/` lifecycle
itself — ARCHIVED banner, status line, what shipped, what was adapted and why, forward pointers to both the
live guide and the deferred remainder.

That lifecycle is why an external review of this codebase yields so little. Most of what an outside reader
would find already sits somewhere in it.
