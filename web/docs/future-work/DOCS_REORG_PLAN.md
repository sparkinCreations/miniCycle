# Documentation Reorganization Plan

**Status:** 📋 Proposed — not started
**Created:** July 20, 2026
**Revised:** July 27, 2026 — claims re-verified against the tree; **step 5 struck** (see below); Option B boundaries re-cut.
**Scope:** `web/docs/` (~238 files, 15 directories — see [PROJECT_STATS.md](../PROJECT_STATS.md))
**Home:** this file. Move to `archive/` when complete.

> Standing rule: if this document conflicts with the actual state of `docs/`, **the actual state wins**.
> This plan has already gone stale once (see the struck step 5). Re-verify before executing.

---

## ⚠️ Struck: original step 5 (schema dedupe) — do NOT run it

The original plan claimed `data-schema/` held a duplicate pair, that the **spaces**-named
`SCHEMA 2 5.md` was current (June 26), that `SCHEMA_2_5.md` was stale (January 17), and
prescribed:

```bash
# DO NOT RUN — retained only so the mistake isn't re-derived
git rm "web/docs/data-schema/SCHEMA_2_5.md"
git mv "web/docs/data-schema/SCHEMA 2 5.md" web/docs/data-schema/SCHEMA_2_5.md
```

**That work was already done** by commit `9f2e10da` *("docs(schema): audit Schema 2.5 docs
against code + consolidate duplicate")*. As of July 27, 2026:

- `data-schema/` contains exactly `SCHEMA_2_5.md` and `MCYC_FILE_FORMAT.md`.
- No spaces-named schema file exists anywhere in the tree.
- The surviving `SCHEMA_2_5.md` is the **current** one — its header reads
  *"Last Updated: July 26, 2026 — audited field-by-field against `createInitialState()`,
  `types.js`, and the modules that read/write each field."*

Running the block today would `git rm` the freshly-audited schema doc and then fail on the
`git mv` (missing source), leaving the schema documentation **deleted**. Step 5 is removed
from Option A below.

*Lesson for this plan generally: it encodes a snapshot. Verify each step against the tree at
execution time.*

---

## Why

The top-level structure is mostly sound. Four problems motivate this plan, all found through
real navigation attempts. Counts re-verified July 27, 2026:

1. **`developer-guides/` (41 files) mixes four document types** — onboarding, how-to,
   architecture explanation, and lookup reference are interleaved, so finding a document
   requires already knowing its name.
2. **`guides/` (3 files) has no identity** — the project's single best onboarding document
   (`HOW_MINICYCLE_WORKS.md`) sits unadvertised next to two modal how-tos.
3. **Incident write-ups are scattered** — `INCIDENT_service-worker-stale-cache.md` in
   `future-work/` (it is history, not future work), `FIX_3_STALE_CACHE.md` in
   `developer-guides/`, `BUG_undo-redo-rollback-ui-refresh.md` in `archive/`. The postmortem
   culture is real but invisible.
4. **Misc hygiene** — completed plans still in `future-work/` (28 items, including
   `BUILD_PIPELINE_PLAN.md` and `BOOT_PERF_ROADMAP.md`, both shipped), error-handling docs
   filed under `security/`, a stray `.rtf` in `project-info/`, and a Python script + PDF in
   `future-work/`.

## Organizing principle

Sort by **what the reader is trying to do**, not by topic. Every doc answers one question:

| Reader intent | Folder | Test |
|---|---|---|
| "I'm new — teach me" | `start-here/` | Read once, in order |
| "I need to change code" | `working-on-code/` | Task-oriented, followed while working |
| "Why is it built this way?" | `architecture/` | Explanation, decision rationale |
| "What is the exact value/API/key?" | `reference/` | Looked up, never read cover-to-cover |
| "What happened and what did we learn?" | `incidents/` | Dated postmortems |
| "What might we build?" | `future-work/` | Active plans only; done → `archive/` |

**New-doc rule (add to CONTRIBUTING.md):** every new doc declares its folder by answering
*learn / do / why / lookup / incident / plan*.

> This rule — not the moves — is the actual fix. Moving files buys a tidy snapshot that
> decays; the rule is what stops `developer-guides/` regrowing. If only one item from this
> plan ships, ship this one.

### The tie-breaker for "is it how-to or reference?"

Several files read like reference but function as prerequisites. Use the **CLAUDE.md
citation test**: if the repo-root [CLAUDE.md](../../../CLAUDE.md) tells you to read it
*before doing X*, it is `working-on-code/`, no matter how lookup-ish the prose is.

By that test these stay in `working-on-code/`, **not** `reference/`:
`CONSTANTS_SYSTEM_GUIDE`, `SECURITY_GUIDE`, `MESSAGING_SURFACES`.

---

## Option A — Surgical (recommended first; ~14 moves, one sitting)

Fixes every navigation complaint without touching the 41-file folder.

1. **Dissolve `guides/`:**
   - `guides/HOW_MINICYCLE_WORKS.md` → `start-here/`
   - `guides/confirmation-and-notification-modal.md`,
     `guides/miniCycle-module-notifications-guide.md` → `features/`
2. **Create `start-here/`** (ordered reading path; number the entries in `_sidebar.md`):
   1. `WHAT_IS_MINICYCLE.md` (from `user-guides/`; leave a sidebar link in user-guides)
   2. `HOW_MINICYCLE_WORKS.md` (from `guides/`)
   3. `FIRST_CONTRIBUTION.md` (from `developer-guides/`)
   4. `GETTING_STARTED.md` (from `developer-guides/`)
   5. `FRAMEWORK_EQUIVALENTS.md` (from `architecture/`)
   6. `FOLDER_STRUCTURE.md` (from `developer-guides/`)
   7. `DEV_SERVER.md` (from docs root)
3. **Create `incidents/`:**
   - `future-work/INCIDENT_service-worker-stale-cache.md`
   - `developer-guides/FIX_3_STALE_CACHE.md`
   - `archive/BUG_undo-redo-rollback-ui-refresh.md`
4. **Triage `future-work/`:** completed plans (`BUILD_PIPELINE_PLAN.md`,
   `BOOT_PERF_ROADMAP.md`, others per review) → `archive/`;
   `generate_testing_pdf.py` + `miniCycle_Testing_Directions.pdf` → `testing/`.
5. ~~Schema dedupe~~ — **struck, already done.** See the warning at the top of this file.
6. **Misc:** archive or delete
   `project-info/example of what code could be based on photos.rtf`.

## Option B — Full reorganization (only after A has settled)

Everything in A, plus the `developer-guides/` split. **Higher risk** — see
[Router coupling](#router-coupling-the-real-cost-of-option-b).

- **Split `developer-guides/` (41 files):**
  - → `working-on-code/`: `MAKING_CODE_CHANGES`, `HOW_TO_ADD_COOKBOOK`, `DI_PATTERNS`,
    `CODING_STANDARDS`, `DEVELOPMENT_WORKFLOW`, `TESTING_GUIDE`, `DEBUG_MODE`,
    `EVENT_LISTENER_GUIDE`, `ASYNC_UI_PATTERNS`, `ERROR_RECOVERY`,
    `AI_ASSISTED_DEVELOPMENT`, `CLAUDE.md`, `HIDDEN_CODEBASE_INSIGHTS`,
    `DEVELOPMENT_ASSISTANT_NOTES`, **plus** `CONSTANTS_SYSTEM_GUIDE`, `SECURITY_GUIDE`,
    `MESSAGING_SURFACES` (moved here from the original plan's `reference/` list — see the
    citation test above)
  - → `architecture/`: `APPINIT_SYSTEM`, `MODULE_SYSTEM_GUIDE`, `MODULE_LOADER_GUIDE`,
    `CSS_ARCHITECTURE_GUIDE`, `HISTORY_SYSTEM`, `BACKGROUND_PATTERN`, `ARCHITECTURE_OVERVIEW`
  - → `reference/` (new): `API_REFERENCE`, `DATA_SCHEMA_GUIDE`, `TASKDOM_DI_GUIDE`
  - → `features/`: `VOCAB_THEME_SYSTEM`, `SVG_ICON_SYSTEM`, `SVG_ANIMATION_OVERLAY_GUIDE`,
    `SAMPLE_ROUTINES`, `FIRST_RUN_WELCOME_*`
  - → `archive/`: `COMPREHENSIVE_CODE_REVIEW_DEC_2025`, `INNERHTML_AUDIT`, other one-time audits
  - `INDEX.md` and `DEVELOPER_DOCUMENTATION.md` become thin routers or merge into `docs/README.md`
- **Create `reference/`:** absorb `data-schema/` (`SCHEMA_2_5`, `MCYC_FILE_FORMAT`),
  `LABEL_REGISTRY_REFERENCE` (from `architecture/`), `FEATURE_LIST` (from `features/`), and
  `features/minicycle-recurring-guide.md` **retitled** `RECURRING_SYSTEM_REFERENCE.md` (it is
  a deep reference, not a user guide; its changelog-style intro moves to CHANGELOG).
- **`architecture/` adjustments:** add `RECURRING_WATCH_FUNCTION.md` from `features/` (it is
  an ADR — salvage the polling-vs-timeout rationale, refresh the stale 30 s interval example
  or delegate to constants); house both Ultimate Architecture PDFs side by side.
- **`security/`:** move `ERROR_HANDLING_AND_TESTING_SUMMARY.md`,
  `ERROR_HANDLING_IMPROVEMENTS.md` → `working-on-code/` or `archive/`.

### Dropped from the original Option B

- **`user-guides/QUICK_REFERENCE.md` → `reference/`** — dropped. It is end-user-facing;
  `user-guides/` maintains a clean audience split that merging developer lookup with user
  lookup would destroy.
- **Rename `future-work/` → `plans/`** — dropped. 28 files' worth of path churn for a
  marginal naming gain, on top of everything else Option B moves. `future-work/` already
  passes the intent test.
- **Merge `deployment/` + `performance/` → `operations/`** — dropped. Both folders are
  already clean, and `deployment/BUILD_PROCESS.md` is cited by the repo-root CLAUDE.md.

### Target tree (Option B end state)

```
docs/
├── README.md  _sidebar.md  PROJECT_STATS.md
├── ARCHITECTURE_DECISIONS.md  DRIFT_AUDIT_CHECKLIST.md
├── start-here/        (7 files, numbered reading order)
├── working-on-code/   (~18 how-to files)
├── architecture/      (~20 why-files + 2 PDFs)
├── reference/         (~7 lookup files)
├── features/          (per-feature specs + modal guides)
├── incidents/         (postmortems, dated)
├── future-work/       (active plans only)
├── deployment/  performance/  security/  testing/
├── user-guides/  project-info/
├── archive/  vendor/
```

---

## Router coupling: the real cost of Option B

Paths in these files are **load-bearing**:

- `_sidebar.md` (docsify nav)
- **repo-root `CLAUDE.md`** — hardcodes **12** `developer-guides/*.md` paths (verified
  July 27, 2026) and is auto-loaded into every AI session
- `web/docs/developer-guides/CLAUDE.md`
- `docs/README.md`, `developer-guides/INDEX.md`
- `FIRST_CONTRIBUTION.md` / `GETTING_STARTED.md` internal links

A stale path in the root CLAUDE.md **fails silently** — no error, no broken build. It just
degrades every future AI-assisted change by routing to a file that no longer exists. This is
the single biggest reason to keep Option B's blast radius small and to sequence it after A.

## Migration mechanics (both options)

1. **Always `git mv`** — preserves file history.
2. **Update every router** listed above, in the same commit as the moves.
3. **Sweep for stragglers after moving:**
   ```bash
   grep -rn "developer-guides/\|docs/guides/\|future-work/" \
     web/docs web/CLAUDE.md CLAUDE.md --include="*.md" | grep -v archive/
   ```
4. **Docsify aliases** can soft-redirect old sidebar URLs if any are bookmarked.
5. **Verify:** open the docsify site, click every sidebar entry once.

### Proposed: make the sweep a gate, not a ritual

Step 3 is a one-time manual check — exactly the discipline that lapses, which is how the rot
this plan fixes accumulated in the first place. The repo already gates on `validate:html`,
`validate:csp`, and `validate:di`.

Add a `validate:docs` script in the same zero-dependency style that fails on:

- relative links in `docs/**/*.md` pointing at a nonexistent file
- markdown files absent from `_sidebar.md` (orphans)
- paths referenced by either `CLAUDE.md` that no longer resolve

This is the durable half of the plan. Without it, a future reorg re-derives the same problem.

## Sequencing

- Docs-only pushes do **not** require `update-version.sh` (see the SHIPPING section of the
  repo-root CLAUDE.md), so this reorg is a low-risk push on its own.
- **Do not mix it into a release.** Land any pending app-code commits via
  `./scripts/update-version.sh --auto --push --changelog` first — a 14-file docs move in the
  same tree makes deploy verification by artifact shape harder to read.

## Definition of done

- [ ] No file in a folder whose intent-test it fails
- [ ] `start-here/` reads 1→7 without a broken link
- [ ] `grep` sweep returns only `archive/` hits
- [ ] `_sidebar.md` and both `CLAUDE.md` routers updated
- [ ] New-doc rule added to `CONTRIBUTING.md`
- [ ] `validate:docs` added and passing in CI *(proposed)*
- [ ] This plan moved to `archive/`
