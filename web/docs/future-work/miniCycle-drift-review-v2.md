# miniCycle — Documentation Drift Review (v2)

**Reviewed:** commit `094de07` (2026-07-24) · APP_VERSION `2.328`
**Date:** 2026-07-25
**Method:** Documentation first (`docs/`, `legal/`, ADRs), then code checked against documented intent.

> **This file replaces `miniCycle-review-findings.md`.** That document was written *before* reading
> `docs/` or `legal/` and asserted as defects a number of things that are documented, deliberate, or
> already planned. Nine of its findings were withdrawn — including all four P0s. If a copy is still in
> `future-work/`, delete it. The withdrawal record is preserved in §4 below.

---

## Method note

The first review read 155k lines of code cold and treated every gap as a defect. That produced
confident findings at a poor accuracy rate, because without the docs there was no way to distinguish
*"this is a gap"* from *"this is a documented tradeoff."*

This version only reports two things:

1. **Drift** — where code no longer matches documented intent
2. **Undocumented territory** — behaviour no doc covers

Anything matching a documented decision is not a finding, even if it would look like one from the code alone.

---

## 1. Drift — code vs. documented intent

### 1.1 `update()`'s notify guarantee is broken in the conflict path — **the one worth fixing**

**Documented intent** — `ARCHITECTURE_DECISIONS.md`, ADR-003:

> `update()` transactionally: snapshots the prior state, applies the change, schedules a save,
> **and notifies subscribers.**

ADR-003 then names the failure mode this guarantee protects against, in its own Consequences:

> (−) The rule must be enforced by discipline/review; a single direct mutation silently skips the
> machinery. **(This is exactly the failure mode behind the undo rollback-UI bug: the *failure* path
> restored state but skipped the notify step.)**

**Code** — `modules/core/appState.js:563-574`:

```js
if (diff > DEBOUNCE.CONCURRENT_MOD_CONFLICT) {
    console.warn('⚠️ Real concurrent modification detected!', { ... });
    this.data = storedData;      // state replaced wholesale
    this.isDirty = false;
    this._hideSavingIndicator();
    return;                      // no notifyListeners()
}
```

`notifyListeners` count inside `save()`: **0**.

**This is the same bug class as `BUG_undo-redo-rollback-ui-refresh.md`, in a second location.** State is
swapped underneath a UI that is never told to redraw. The user keeps working against a view that no longer
matches the data, and their pending edits disappear at the next unrelated render with no explanation.

The `storage`-event handler ~200 lines earlier handles the same situation correctly — it warns the user
*and* calls `notifyListeners()`. Two paths, same problem, one right.

**Fix:** mirror the storage-event handler. Notify the user, notify subscribers.

**Related but distinct:** `HIDDEN_CODEBASE_INSIGHTS.md` §5.5 already documents that the 1000ms threshold
misses conflicts under ~1s. That's the *detection* window. This finding is about what happens *after*
detection succeeds. Both are real; neither covers the other.

---

### 1.2 `beforeunload`-only flush is listed as "leave alone"

**Documented intent** — `future-work/ARCHITECTURE REVIEW FINDINGS.md`, under *"What is genuinely strong
(leave alone)"*:

> **AppState core** — transactional `update()` with snapshot + rollback, debounced vs immediate save,
> multi-tab concurrent-modification detection, **beforeunload flush.**

**Code** — `appState.js:341-350` registers `beforeunload` only. `pagehide` count in `appState.js`: **0**.

`beforeunload` is unreliable on iOS Safari — frequently not fired when an app is backgrounded or swiped
away. Combined with the debounce window, the sequence *check final task → immediately swipe away* can
drop the write on the platform your product screenshots feature most.

You already use `pagehide` correctly for drag interruption in
`modules/ui/taskViewLayoutManager.js:282`, so the event is known — it just didn't reach the state layer.

**Fix:** add `pagehide` and `visibilitychange → hidden` alongside `beforeunload`. Then either update the
"leave alone" entry or note the platform caveat.

---

### 1.3 Stale claims in `ARCHITECTURE REVIEW FINDINGS.md`

That document cites the test runner sharing live storage as an unresolved root-cause item:

> IndexedDB is a *narrow* test-data safety vault with pre-boot recovery (justifies its complexity,
> though that complexity exists to compensate for the test runner sharing live storage — a "someday,
> deliberately" root-cause item).

**This has been fixed.** `appState.js:32-36` documents that the in-app test runner now runs on a separate
origin (`test.minicycle.app`), that isolation is by construction, and that the save-gate / IndexedDB-backup
machinery was **removed**.

The doc still describes complexity that no longer exists and a root cause that's been resolved. Worth a
strike-through — it's the kind of stale entry that makes a future reader preserve complexity for a reason
that expired.

---

### 1.4 `PROJECT_STATS.md` / README counts are stale

| Metric | Documented | Actual (commit `094de07`) |
|---|---|---|
| JS lines | 77,653 | **89,056** |
| JS modules | 117 | **132** |

Roughly 11k lines and 15 modules behind. Cosmetic, but these numbers appear in the public README and are
the kind of thing a developer-audience reader spot-checks.

**Note:** the *"Custom `window.*` Globals (modules): 0"* line is **not** drift. `PROJECT_STATS.md:88`
qualifies it precisely — *"zero modules use `|| window.*` fallbacks"* — and that qualified claim holds.
An earlier version of this review scored the unqualified headline and was wrong to.

---

## 2. Undocumented territory

### 2.1 Migration backups are never pruned — *no doc coverage*

Search across all 232 docs for `migration_backup` / `pre_migration`: **zero results.**

Three prefixes are created, each holding a full copy of the dataset:

| Prefix | Created at | Routine pruning |
|---|---|---|
| `pre_migration_backup_` | `migrationManager.js:423` | none |
| `migration_backup_` | `migrationManager.js:384` | none |
| `auto_migration_backup_` | `migrationManager.js:1132` | none |

The only sweep that catches `pre_migration_backup_` is inside `setupFactoryResetButton()`
(`backupRestoreManager.js:632`), which wipes everything regardless.

**Why it matters here specifically:** `STORAGE_MANAGEMENT.md` documents a careful budget — 256KB buffer,
`canAddToStorage()` gates on task creation, routine creation, duplication, and import. That system governs
**user-initiated** growth. These backups grow **outside** it. So does the undo cache
(`undoRedoManager.js:51-66`, rewritten on every save, `UNDO_STACK: 20`) and the corrupt-data snapshots
(capped at 3).

The documented budget is sound. The gap is that automatic writers don't pass through it.

**Fix:** cap migration backups (2–3, matching `MAX_CORRUPT_BACKUPS`), and route system writers through
`canAddToStorage()` or account for them in `getStorageInfo()`.

---

### 2.2 Force-mode migration ignores its own backup result

`modules/routine/migrationManager.js:710-712`:

```js
if (!skipBackup) {
    const backupResult = await createAutomaticMigrationBackup();
}
```

Assigned, never read. The non-force path at `:748` checks it and aborts on failure. Force mode is the
production path (`orchestrator.js:966`), gated by `checkMigrationNeeded()` — so it only runs when a
migration is genuinely required, which is exactly when the backup matters most.

`eslint.config.js:138` sets `no-unused-vars` to `warn`, so this never failed CI.

**Fix:** check `backupResult` in force mode. Consider `no-unused-vars: 'error'`.

---

### 2.3 Salvage disclosure understates whole-routine loss

**Documented and deliberate** — `ERROR_RECOVERY.md:70-75` describes the salvage ladder, notes that salvaged
data must pass strict re-validation, and records that the `extract-cycles` strategy was dropped precisely
because partial output couldn't survive it. The user-facing message is honest:

> "Data corruption was detected and repaired. **Some recent changes may be missing.**"

So this is **not** silent data loss, and the earlier review was wrong to call it that.

The narrow remaining point: I ran your `close-brackets` strategy against a truncated 4-routine dataset and
it recovered 2 of 4 — losing two entire routines while passing `validateRecoveredData()`. *"Some recent
changes"* reads like a lost checkbox, not two missing routines, and the message doesn't point at the
`miniCycleData_corrupted_<ts>` snapshot that would let someone recover.

**Fix (copy + UX, not architecture):** compare cycle counts pre/post salvage; if entities were lost, say
how many and name the backup key.

---

## 3. Already documented — not findings

Recorded so a future reader doesn't re-raise them.

| Observation | Where it's already decided |
|---|---|
| `required()` isn't enforced; 686 `optional(null)` vs 91 `required()`; strict in 2 modules | **ADR-006**, incl. the same recommended scope: *"worth revisiting for state, storage, migration"* |
| Live references from `getActiveCycle()`/`getTasks()` allow bypassing `update()` | **ADR-003** Consequences — *"must be enforced by discipline/review"* |
| System-driven mutations skipping undo | **ADR-007** |
| No framework / no build | **ADR-001**, amended by **ADR-010** (deploy-time bundling, 2026-07-14) |
| Boot retry / fallback philosophy | **ADR-005** |
| Storage budget, buffer, quota gates, 150-task cap, storage bar | `features/STORAGE_MANAGEMENT.md` |
| Corruption salvage ladder + raw-bytes snapshot | `working-on-code/ERROR_RECOVERY.md` |
| Strict-mode rollout plan (`ENFORCE_REQUIRES` @ `moduleLoader.js:148`) | `future-work/ENFORCE_REQUIRES_ROLLOUT_PLAN.md` (Step 1 shipped 2026-06-30) |
| 1000ms conflict-detection window | `HIDDEN_CODEBASE_INSIGHTS.md` §5.5 |
| Backup responsibility, data-loss liability, "as is" | `legal/terms.html` |
| Backup reminder cadence, storage monitoring, .mcyc export | `legal/user-manual.html` |

---

## 4. Withdrawal record

From the superseded document. Kept because it's the honest calibration for how much weight to give the rest.

| # | Claimed | Reality | Caught by |
|---|---|---|---|
| 1 | Undo cache unmeasured and unreclaimable | `getUndoCacheSizeBytes()` drives UI; Settings has Clear Undo History | You |
| 2 | XSS protection fails open (**critical**) | `featureBoot.js:147` passes `GlobalUtils` directly; branch unreachable | Self-audit |
| 3 | Restore-from-file bricks the app (**P0**) | Exporter copies live localStorage verbatim; app-made backups always carry `metadata` | You, then verified |
| 4 | Backup reminder silently no-ops | `downloadBackupFile` is wired (`moduleManifests.js:411`) | You |
| 5 | No storage budget or usage measurement (**P1**) | `storageUtils.js` (564 lines) + `STORAGE_MANAGEMENT.md` | Docs |
| 6 | Quota handler is the primary defense and gives up | It's a backstop behind `canAddToStorage()` gates | Docs |
| 7 | Salvage loss reported as success (**P0**) | Label says *"Some recent changes may be missing"* | Docs |
| 8 | "Enable DI strict mode" as a new recommendation | ADR-006 + rollout plan; partly shipped | Docs |
| 9 | Positioning/liability gap re: professional use | `terms.html` disclaims data loss and fitness for purpose | Docs |

**Rate: nine corrections against roughly six surviving findings.** The dominant cause was reviewing a
documented codebase without reading its documentation. The secondary cause was proving a *mechanism*
(e.g. the `metadata` crash chain) and then asserting *reachability* without checking whether anything in
the app actually produces the triggering input.

---

## 5. Recommended order

| # | Item | § | Effort |
|---|---|---|---|
| 1 | Notify user + subscribers on conflict discard | 1.1 | ~1 hour |
| 2 | `pagehide` / `visibilitychange` flush | 1.2 | ~1 hour |
| 3 | Check `backupResult` in force mode; `no-unused-vars: error` | 2.2 | ~15 min |
| 4 | Cap migration backups; account for system writers in the budget | 2.1 | Half a day |
| 5 | Quantify salvage loss; surface the backup key | 2.3 | ~2 hours |
| 6 | Strike the resolved test-runner note; refresh stats | 1.3, 1.4 | ~15 min |

Roughly one day. Item 1 is the one I'd do first — it has a documented precedent in your own bug archive
and it silently loses in-flight user work.

Everything else worth doing is already in `future-work/`, written by you, with better context than I have.

---

## 6. Coverage and reliability

**Read:** all ADRs; `STORAGE_MANAGEMENT.md`; `ERROR_RECOVERY.md`; `DRIFT_AUDIT_CHECKLIST.md`;
`ENFORCE_REQUIRES_ROLLOUT_PLAN.md`; `HIDDEN_CODEBASE_INSIGHTS.md` (partial);
`ARCHITECTURE REVIEW FINDINGS.md` (partial); `PROJECT_STATS.md`; `user-manual.html`; `terms.html`.
Code: `appState.js`, `diBase.js`, `storageUtils.js`, `dataRecovery.js`, `migrationManager.js`,
`backupManager.js`, `undoRedoManager.js` (partial), `backupRestoreManager.js`, `cycleCompletion.js`,
`dailyResetManager.js`, `notifications.js`, `service-worker.js` (structure), boot sequence.

**Not read:** ~200 remaining docs, including the six `CODE_AUDIT_*` files and `CODE_REVIEW_2026_03.md`.
Some of §1–§2 may already appear there. The recurring subsystem (17 modules), guided tours, rendering
layer, plugin system, CSS, Lite, Chrome extension, Android shell, and the test suite were not reviewed.

**Reliability:** every item in §1–§2 is quoted against both the documented claim and the code line, so each
is checkable in under a minute. Given the correction rate in §4, please verify rather than trust. The
salvage measurement in §2.3 was produced by executing your own `close-brackets` and `validateRecoveredData`
logic in isolation.

**On your documentation:** 232 documents, ten ADRs with rejected-alternatives sections, six prior audits, a
doc-drift tracker, and an accuracy-correction block in `ENFORCE_REQUIRES_ROLLOUT_PLAN.md` where you flagged
your own line numbers as stale and told the reader which anchors to trust. That last one is better
discipline than most funded teams maintain. It is also why this review is short: most of what an outside
reviewer would find, you had already found, written down, and scheduled.
