# Docs Audit Plan — accuracy, numbers, archive, sidebar (round 0 + 12 rounds)

> **Status:** plan for review — nothing audited yet. Proposed Oct 27 2026;
> revised Nov 5 2026 (round 0, two new gates, line-budgeted rounds, wider
> scope — see *Decisions*).
> **Owner:** MJ reviews each round; Claude executes.
> **Scope:** the 134 live docs under `web/docs/` (14 folders + 8 root files),
> plus the repo-root `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and
> `CODE_REVIEW_REPORT.md` (round 2), and the public user manual
> `web/legal/user-manual.html` for checks 2 and 6 only (round 1). The 119 docs
> already in `archive/` are out of scope except as a destination.

## Why

The docs grew with the app: 134 live pages, 163 sidebar entries, and a validator
(`npm run validate:docs`) that already catches dead links, pages the sidebar
cannot reach, and stale paths in the repo-root `CLAUDE.md`. What nothing checks
is whether a page is still **true**, whether its **numbers** are the live ones,
and whether it should still be a live page at all. Those three are this audit.

## What "done" means for one doc

Every doc in a round gets the same six checks, in this order:

1. **Still true?** Every claim about code or behaviour is checked against the
   code as it is in the round's version. Module names, function names, file
   paths, DI dep names, DOM ids, settings keys, flows. A claim that is wrong
   is fixed; a claim that cannot be checked is reworded or removed. Each fix
   cites the file it was checked against in the commit message.
   **The name-level half of this check is a gate, not a read** (built in
   round 0): every backticked code reference in a live doc must resolve,
   using the symbol table `validate:comments` already builds from `modules/`,
   `tests/`, `scripts/` and root JS, and the same three precision-first
   shapes it treats as references. So the hand review is spent on what no
   gate can see — behaviour, flows, and whether a sentence is still true —
   not on "does `foo()` still exist". **Schema 2.5 names** (`activeCycleId`,
   `data.cycles`, `highPriority`, `priorityColor`, `deleteWhenComplete`)
   are the commonest stale claim after the Sep 2026 rename, so they are
   gated too (see *Decisions*); in a doc that is not about the migration,
   each one becomes the 2.6 name or the `cycleMode.js` / `priorityLevel.js`
   accessor.
2. **Numbers.** Volatile counts never appear as literals outside
   `PROJECT_STATS.md`: module count, test count, CSS file count, doc count,
   JSDoc count, line counts, pass rates, the *current* version. They become
   a reference ("see `PROJECT_STATS.md`") or a relative statement that does
   not date ("every manifest module"). **Kept as literals:** historical
   version citations ("fixed in v2.632", "since v2.301"), dates, incident
   numbers, measurements that are findings ("840ms on the old Android"),
   and limits that are code constants (`LIMITS.MAX_TASKS`), which are cited
   by name instead. `PROJECT_STATS.md` itself stays generated — its numbers
   come from the build, not from this audit.
3. **Archive or keep.** A doc is archived when it is a plan that shipped, a
   design that was superseded, or a guide to something removed. Archived =
   moved to `archive/`, a one-line banner at the top (`> Archived <date>:
   <why>; see <successor>`), and its sidebar entry moved to the Archive
   section. Incident postmortems stay live: they are history by design.
   A doc that is half-stale is **not** archived — it is fixed, or split so
   the shipped part is archived and the open part stays in `future-work/`.
4. **Sidebar + routing.** `_sidebar.md` title matches the doc's H1 and sits
   in the right section; `INDEX.md` routes to it if it is a guide; the
   repo-root `CLAUDE.md` still points at it if it is one of the "read first"
   guides (the validator gates this).
5. **Freshness header.** A `**Last verified**` line set to the round's date,
   replacing `**Last Updated**` (88 docs have one today). The audit can only
   vouch for when a page was last *checked against the code*, which is what
   the new name says; "Last Updated" on an untouched page reads as a claim
   the page cannot keep. Plus a `> **Status**` line where the doc's nature
   calls for one (plans, audits, references with a version).
6. **Quality claims.** An absolute claim — "100%", "fully tested", "WCAG AA",
   "zero globals", "production-ready", "no known bugs", "complete coverage" —
   stays only if a gate or test enforces it **today** and the doc names it
   (`validate:di` gated at 0, the contrast suite, `test:a11y`). Otherwise it
   is reworded to the measured, dated fact ("4,289 tests passed on Oct 26
   2026" belongs in `PROJECT_STATS.md`, not here) or archived with its doc.
   A claim that was true once and is not enforced is the most misleading
   kind of stale, so this check is not optional. Sizing (Oct 27 2026): the
   phrase grep matches 101 live docs, heaviest `performance/PERFORMANCE_SUMMARY.md`
   (17) and `project-info/ACCESSIBILITY.md` (13); like the numbers, it is a
   read, not a regex — "100%" is also a CSS width.

The round is done when `npm run validate:docs` is green, the round's commit
is in (`docs(audit): round N — <folders>`), and MJ has a short report: what
changed, what was archived, and the questions only MJ can answer (open
questions never get guessed — they go in the report).

## What the audit will NOT do

- Rewrite voice or restructure a doc that is accurate. Fix, don't polish.
  A round may *propose* a cut or merge in its report (round 7b is expected
  to), but makes it only after MJ says yes. The two structural questions
  this rule would otherwise leave standing forever are listed under
  *Decisions → Open* instead of being left implicit.
- Touch `archive/` content (its links may point at the world as it was).
- Touch `CHANGELOG.md` (generated by the release script).
- Change code to match a doc. If the doc and the code disagree, the code wins
  and the doc changes; a doc that reveals a real bug gets a note in the
  report, not a code change inside the audit.

## Rounds

A round 0 of triage and tooling, then twelve audit rounds grouped so each
reads coherently. Start Here first because newcomers hit it first and it
carries the most numbers; Future Work last because its docs are the ones most
likely to be archived, and by then the rest of the docs say what actually
shipped — except the plans whose own status line already says so, which
round 0 handles without waiting.

**Rounds are sized by lines, not doc count.** The first cut gave every round
12–17 docs, but round 3 came to ~10,300 lines and round 7 to ~8,400 against
~4,400–5,700 for the rest, because the four longest docs in the tree
(`DRAG_DROP_ARCHITECTURE` 2,275, `RECURRING_SYSTEM_REFERENCE` 2,035,
`MCYC_FILE_FORMAT` 1,293, `UPDATE-VERSION-GUIDE` 1,298) cluster there. Budget:
**~6,000 lines a round**; a round over it is split, not rushed. Both were split
below.

| Round | Docs | Lines | Scope | Status |
|---|---|---|---|---|
| 0 | — | — | **Triage + tooling.** (a) Archive or split the plans whose status line already says shipped: `LARGE_MODULE_SPLITS_PLAN` (CLOSED Aug 2026), `WELCOME_SCREEN_PLAN` (CLOSED Sep 2026), `SETTINGS_TOGGLE_LATCH_GAP` (FIXED v2.587), and `SCHEMA_2_6_PLAN`, whose status still says *Planned* though `SCHEMA.CURRENT` is `'2.6'` (shipped Sep 2026) — split if any part is still open. Read the status lines, confirm each against the code or `CHANGELOG.md`, nothing more. (b) Build the two gates in `validate:docs` / `validate:comments` in **warning** mode: volatile counts, Schema 2.5 names, and backticked code references (see *Decisions*). (c) Record each gate's baseline count in the round report — that is the number later rounds drive to zero. | ✅ done Nov 5 2026 — see *Round 0 result* |
| 1 | 14 | ~4,400 | **Start Here** (7), **User Guides** (3), root routers: `README.md`, `INDEX.md`, `PROJECT_STATS.md` (header + prose only), `DEVELOPER_DOCUMENTATION.md`; plus **checks 2 and 6 only** on `web/legal/user-manual.html` (the page users actually read) | ✅ done Nov 5 2026 — see *Round 1 result* |
| 2 | 16 | ~6,100 | **Project Info** (7); root: `ARCHITECTURE_DECISIONS.md`, `DRIFT_AUDIT_CHECKLIST.md`; **Reference**: `API_REFERENCE`, `DATA_SCHEMA_GUIDE`, `FEATURE_LIST`; **repo root**: `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CODE_REVIEW_REPORT.md` | ✅ audited Nov 6 2026 — see *Round 2 result* (questions open) |
| 3a | 6 | ~5,600 | **Reference** rest: `LABEL_REGISTRY_REFERENCE`, `MCYC_FILE_FORMAT`, `RECURRING_SYSTEM_REFERENCE`, `REVIEW_PATTERNS`, `SCHEMA_2_6`, `TASKDOM_DI_GUIDE` | pending |
| 3b | 8 | ~4,600 | **Testing** (4); **Performance** (4) | pending |
| 4 | 13 | ~5,000 | **Working on Code** A–H: `AI_ASSISTED_DEVELOPMENT` … `HOW_TO_ADD_COOKBOOK` (13) | pending |
| 5 | 13 | ~5,700 | **Working on Code** rest (5): `MAKING_CODE_CHANGES`, `MESSAGING_SURFACES`, `SECURITY_GUIDE`, `TESTING_GUIDE`, `VALIDATION_GATES`; **Security** (6 incl. `audits/`); **Deployment**: `BUILD_PROCESS`, `DEPLOYMENT` | pending |
| 6 | 13 | ~5,000 | **Deployment** rest (4): `CLICK_TRACKING`, `PWA_OFFLINE_ARCHITECTURE`, `SERVICE_WORKER_UPDATE_STRATEGY`, `UPDATE-VERSION-GUIDE`; **Incidents** (5); **Architecture** A–B (4): `APPINIT_EXPLAINED`, `APPINIT_SYSTEM`, `ARCHITECTURE_OVERVIEW`, `BACKGROUND_PATTERN` | pending |
| 7a | 12 | ~5,000 | **Architecture** C–Q except the two below: `CODEBASE_VISUAL_MAP` … `QUICK_ACTIONS_ARCHITECTURE` | pending |
| 7b | 2 | ~3,400 | **Architecture**, the two longest of C–Q: `DRAG_DROP_ARCHITECTURE` (2,275), `EVENT_FLOW_PATTERNS` (1,158). Line-for-line truth checks on these are the costliest work in the audit; a section that is accurate but describes code a reader would rather read is a candidate to cut, which is the one restructure this round may *propose* (in the report — see *What the audit will NOT do*) | pending |
| 8 | 12 | ~5,700 | **Architecture** rest (4): `RECURRING_WATCH_FUNCTION`, `ROUTINE_SWITCHER_ARCHITECTURE`, `THEME_ARCHITECTURE`, `UNDO_REDO_ARCHITECTURE` + `diagrams/`; **Features** A–S (8): `AUTO_UNCHECK_DAILY` … `STORAGE_MANAGEMENT` | pending |
| 9 | 16 | ~4,600 | **Features** rest (7): `SVG_ANIMATION_OVERLAY_GUIDE`, `SVG_ICON_SYSTEM`, `TASK_OPTIONS_CUSTOMIZER`, `UX_RATINGS`, `VOCAB_THEME_SYSTEM`, the two lowercase notification guides; **Future Work** A–L except this plan (9) | pending |
| 10 | 8–11 + sweep | ~4,800 before round 0 | **Future Work** rest, minus what round 0 archived, **plus this plan**; then the final sweep: `_sidebar.md` order and section titles, `INDEX.md`, `archive/README.md`, `CLAUDE.md` routes, the gates flipped from warning to failing, and one last `validate:docs` | pending |

Counts and line totals are from the tree on Nov 5 2026; a round may shift a
doc or two to stay coherent, and the table is updated as rounds close.

### Round 0 result (Nov 5 2026)

**Archived** (status lines confirmed against the code / `CHANGELOG.md`; banner
added, sidebar entry moved to *Archive → Plans Completed (2026)*, every inbound
path repointed):

- `LARGE_MODULE_SPLITS_PLAN` — closed Aug 28 2026.
- `WELCOME_SCREEN_PLAN` — closed Sep 2026 (`modules/ui/titleScreen.js`).
- `SETTINGS_TOGGLE_LATCH_GAP` — fixed v2.587; lesson kept as REVIEW_PATTERNS #18.
- `SCHEMA_2_6_PLAN` — shipped v2.573 (`SCHEMA.CURRENT` is `'2.6'`; all success
  criteria checked; its *Status* line had never been updated). **Split:** its one
  unshipped item, dev-build `validateTask()` enforcement, moved to
  `future-work/DEV_VALIDATE_TASK_ENFORCEMENT.md`.

**Gate baselines** (warning-only; the numbers later rounds drive to zero):

| Gate | Where | Baseline |
|---|---|---|
| Volatile counts | `validate:docs` | 45 hits in 25 docs |
| Schema 2.5 stored names | `validate:docs` | 10 hits in 7 docs |
| Docs code references | `validate:comments` (docs pass) | 124 hits in 41 docs |

All three are *candidates*, not findings: sampled precision was high for the
first two after tuning (both started far noisier — 95 and 74 — before matching
on use rather than on bare words), and 9 of 10 sampled docs-reference hits named
code that exists nowhere (`completeMiniCycle`, `removeRecurring`,
`setupDueDateButtonInteraction`, …). Known noise in the third: framework names in
`FRAMEWORK_EQUIVALENTS.md` and template placeholders (`initModuleName`). Before
round 10 flips any gate to failing, each needs an allow-list for what remains.

**Carried to later rounds:** `STATE_TRUTH_MIGRATION.md` #20 (the UUID re-key)
shipped inside 2.6 but is not marked done (round 10); `core/constants.js`
comment on `COLORS.PRIORITY_DEFAULT` still names `task.priorityColor` (code, not
docs — next code change in that file).

**Code comments touched — so round 0 ships with a release.** Archiving moved
docs that 12 module files cite by path in comments (`docs/future-work/…` →
`docs/archive/…`), plus one test file. Comment-only, but measured: the build is
deterministic (two clean rebuilds identical), and these edits still changed 912
`dist/` files, because release source maps embed the original source (comments
included) and the content-hashed names follow. A comment edit in `modules/` is
therefore a bundle change, and the round cannot be split either: the doc moves
without the comment edits fail `validate:docs` (code citations). It ships via
`update-version.sh`, not as a docs-only push. **Lesson for later rounds:**
archiving a doc that `modules/` cites by path makes that round a release round;
check `grep -rn "<name>" web/modules` before choosing what to archive.

### Round 1 result (Nov 5 2026)

**Front door built** (MJ's decision): `INDEX.md` 780 → 93 lines, a task router
mirroring `CLAUDE.md`'s read-first list; `DEVELOPER_DOCUMENTATION.md` **archived**
into it (its only unique job — pointing at `DEPENDENCY_MAP`, `APPINIT_EXPLAINED`,
`DEVELOPMENT_WORKFLOW` — moved to INDEX); 15 inbound links repointed;
`docs/README.md` stays the landing page and its use-case block now defers to INDEX.

**Audited:** all 7 Start Here docs, the 3 user-guide stubs, `docs/README.md`,
`INDEX.md`, `PROJECT_STATS.md` (prose only — its header is rewritten by
`update-version.sh`, so it keeps `**Last Updated**`), and the user manual (checks
2 and 6). Gates: volatile counts 45 → 39; Schema 2.5 names 10 (none were in this
round's docs); docs code references unchanged at 124 (the 13 in
`FRAMEWORK_EQUIVALENTS` are framework API names, expected noise).

**Found in code, not fixed** (the audit changes no code — see the round report):
routine creation still keys new routines by **title**, not a generated id
(`routineManager.js` ×4); `window.getMiniCycleBootTiming` is a custom global in
`orchestrator.js`; `--font-size-md` is used in ≥5 stylesheets and defined nowhere;
`styles/themes/theme-manager.js` is imported by nothing; stale headers in
`schemaMigration26.js` ("NOT WIRED YET") and an `AppState.update` JSDoc example
(`state.data.cycles`).

### Round 2 result (Nov 6 2026)

**Audited:** all 16 docs (three readers, disjoint files). Heaviest corrections:
`API_REFERENCE` (most documented calls did not exist; rewritten to the DI / appContext
names — every call in its examples now exists; the Theme Manager section came from
PR #116), `ACCESSIBILITY` (claimed the skip link, reduced motion and keyboard
shortcuts were missing, and contrast unverified — all exist, contrast is CI-gated),
`BROWSER_COMPATIBILITY` (real floor from the feature gate: Chrome 80 / Firefox 74 /
Safari 13.1), `FEATURE_LIST` and `DATA_SCHEMA_GUIDE` (~15 wrong rows each), `ROADMAP`
("open source" → source-available, per `LICENSE`). Gates: volatile counts 39 → 33;
Schema 2.5 names 10 (none in this round); docs code references 125 (only noise left
in this round). Check 4: every sidebar title is its H1's short form. **Archived** (MJ:
"archive as you see fit"): the repo-root `CODE_REVIEW_REPORT.md` →
`archive/CODE_REVIEW_REPORT_DEC_2025.md` — a one-off review from Dec 19 2025 whose seven
recommendations are all closed or superseded; nothing linked to it but this plan. No other
doc in the round met the bar: the rest were fixed in place.

**App code in this round — so it ships with a release.** Reading the Lite routing
for `BROWSER_COMPATIBILITY` led to a change MJ asked for in this PR:
`utils/deviceDetection.js` no longer redirects to Lite on every new version from
user-agent regexes, ≤2 cores or a `3g` connection. It times each boot and, after
`LIMITS.SLOW_BOOTS_BEFORE_LITE_OFFER` slow boots in a row
(`BOOT_TIMEOUTS.SLOW_BOOT_LITE_OFFER`; one on ≤2 cores), **asks** once, saying Lite
keeps its own separate list — it does (`miniCycleLite*` storage keys), so the old
silent redirect landed users with routines on an empty Lite list. The answer is kept;
Lite's *Try Full Version* counts as no. **Found while testing it in the real app:**
the boot-time device check had never run in production — `featureBoot` built the `ui`
API's `deviceDetectionManager` from `deps.ui`, but the manifest delivers it on
`deps.utils`, so `uiBoot` always got `undefined` (`validate:api` passes: the name is
allow-listed, only its source is wrong). Fixed in the same commit; the old post-boot
redirect was therefore dead code, and the Lite routing users actually got came from
the `miniCycle.html` feature gate and boot-failure fallbacks.

**Found in code or shipped pages, not fixed:** `legal/accessibility.html` says
keyboard reordering needs *Show Move Arrows* (Alt+↑/↓ works without it);
`netlify.toml` CSP still allows cdnjs, Google Fonts and Formspree, which nothing
loads; a hardcoded string in `preferencesBgImage.js`; the milestone levels are a
literal array in `cycleCompletion.js`; stale comments in `types.js`, `taskCore.js`,
`guidedTourDefinitions.js` ("thirteen" tours; there are 14), `appContext.js`.

**Open questions (MJ):** the privacy policy vs
the tracking on the `.mcyc` format page and the 50 raw timestamps the tracker keeps;
`PRIVACY.md`'s COPPA heading and competitor table; WCAG 2.2 as the target; the
copyright statement's name placeholder; the roadmap's tiers, prices and dates; the
PR checklist's `@version` / `@pattern` requirement; system-aware dark mode in the
README; merging `DATA_SCHEMA_GUIDE` into `SCHEMA_2_6` (round 3a) and trimming
`ACCESSIBILITY` to its developer parts.

## How a round runs

1. Claude lists the round's docs and, for each, the checks that found
   something (a doc that passes all six is listed as "clean").
2. Fixes land in one commit per round, docs only, no app code, no `archive/`
   edits beyond the moves. The commit message lists every archived doc.
   **Round 0 is the one exception:** its commit also carries the gate code in
   `web/scripts/` (validator tooling, not part of the `web/dist/` bundle;
   confirm with `npm run build:web` that `dist/` is unchanged).
3. `npm run validate:docs` green before the commit (the new gates warn until
   round 10, so "green" means no *new* failures).
4. The round's report goes to MJ in chat. MJ reviews; the next round starts
   only after that. The report includes each gate's count before and after.
5. Docs-only commits push without a release (CLAUDE.md allows docs-only
   pushes); if a round also touches `web/` source for a build-facing doc
   (it should not), it waits for the next release instead. **The user manual
   is the known case:** `web/legal/user-manual.html` is a shipped page, so
   round 1's fixes to it are prepared in the round but ship with the next
   `update-version.sh` release, never as a bare push. **So does any round that
   archives a doc `web/modules/` cites by path** — the comment edit changes the
   shipped source maps and every content hash downstream (measured in round 0).
6. **Merge open PRs that touch a round's docs before that round starts.**
   As of Nov 5 2026, PR #111 edits `reference/REVIEW_PATTERNS.md` (round 3a)
   and `working-on-code/VALIDATION_GATES.md` (round 5).

## Known hot spots (sizing passes, Oct 27 and Nov 5 2026)

- **117 live docs** contain at least one literal that *might* be a volatile
  number. Most are legitimate version citations; the real offenders are the
  counts. The sizing grep cannot tell them apart, so the number check is a
  read, not a regex.
- Heaviest literal density: `LARGE_MODULE_SPLITS_PLAN`, `STATE_TRUTH_MIGRATION`,
  `PWA_OFFLINE_ARCHITECTURE`, `SERVICE_WORKER_UPDATE_STRATEGY`,
  `MCYC_FILE_FORMAT`, `BOOT_PERF_ROADMAP`, `VALIDATION_GATES`.
- **Least recently touched** (likely stale or archive candidates):
  `security/audits/AUDIT_SUMMARY.md` (Dec 2025), `BROWSER_COMPATIBILITY.md`
  (Jan 2026), `COPYRIGHT_AUTHORSHIP_STATEMENT.md`, `CLICK_TRACKING.md`,
  the three `performance/` guides and `TESTING_ARCHITECTURE.md` (Jun 2026).
- `PWA_OFFLINE_ARCHITECTURE.md` and `BOOT_PERF_ROADMAP.md` were rewritten
  piecemeal through Oct 2026 (update path, heal tiers) and need a
  coherence pass, not just a number pass.
- **Schema 2.5 names** (Nov 5 2026): 29 live docs contain one of the bare
  words `activeCycleId`, `data.cycles`, `highPriority`, `priorityColor`,
  `deleteWhenComplete`, but most of those are CORRECT today: `activeCycleId`
  is still a common local variable name (the live modules use it too),
  `highPriority` / `deleteWhenComplete` are kept `taskOptionButtons` option ids
  (decided Sep 2026), and the undo snapshot still has a field called
  `activeCycleId`. The round-0 gate therefore matches stored-field *use*, and
  finds 10 candidates in 7 docs — e.g. `features/AUTO_UNCHECK_DAILY.md:154`
  (watches "the `activeCycleId` change"; the field is `activeRoutineId`) and
  `future-work/STATE_TRUTH_MIGRATION.md:408` (`state.data.cycles[…]`).
  *Corrected in round 0:* the Nov 5 revision of this plan listed
  `TASK_OPTIONS_CUSTOMIZER.md` as stale — its `highPriority: true` lines are
  option ids, so it is not — and overstated `VOCAB_THEME_SYSTEM.md:20`, where
  `activeCycleId` reads as a local holding the routine id (a naming nit, not a
  wrong claim).
- **Stale counts in "read first" guides** (Nov 5 2026): `REVIEW_PATTERNS.md`
  (3134 tests, 136 modules), `VALIDATION_GATES.md` (136 modules),
  `HIDDEN_CODEBASE_INSIGHTS.md` (102 modules) — the pages CLAUDE.md routes
  every change through, so wrong numbers there spread fastest.
- **The front door is the stalest page:** `INDEX.md` (780 lines) still says
  "Last Updated: December 20, 2025", "Production Ready" and "74.8% reduction
  (15,677 → 3,674 lines)", and two rows of its quick-nav table point at each
  other's docs (testing ↔ performance).

## Decisions

Taken (Oct 27 2026):

- **Quality claims get the sixth check** (above): archive or reword every
  outstanding one. — MJ.
- **`DEVELOPER_PROFILE.md` archived.** It was a private, gitignored note that
  was never committed or published; it now lives at
  `archive/DEVELOPER_PROFILE.md`, still ignored, with a banner, and the
  by-name carve-outs in the build script, the validator and two deployment
  docs are gone. Not in the sidebar: the validator treats untracked files as
  absent, so a link to it would fail in CI. — MJ.
- **`COPYRIGHT_AUTHORSHIP_STATEMENT.md` stays in Project Info**, next to
  `PRIVACY.md` and `CONTRIBUTING.md`, which is where the other legal-facing
  pages already sit; it gets the normal round-2 checks. — recommended,
  MJ undecided; say so if you want it elsewhere.

Taken (Oct 27 2026, "go with the recommendations" — MJ):

- **Gate the numbers.** `validate:docs` gains a check for volatile count
  patterns outside `PROJECT_STATS.md`: a warning from round 1, a gate in
  round 10, with an allow-list for legitimate literals.
- **`archive/` stays flat.** The banner line carries the date.
- **All five incidents stay live** under Incidents.

Taken (Nov 5 2026, review of this plan — MJ: "update the plan with your
recommendations"):

- **Gate Schema 2.5 names** alongside the numbers. `validate:docs` warns on
  `activeCycleId`, `data.cycles`, `highPriority`, `priorityColor` and
  `deleteWhenComplete` in any live doc outside an allow-list (the schema and
  migration docs, `MCYC_FILE_FORMAT`, incidents, and this plan). Warning from
  round 0, failing from round 10 — the same ratchet as the numbers gate.
  Rationale: the Sep 2026 rename is the largest single source of untrue
  claims in the live docs, and unlike most of check 1 it is mechanical.
- **Automate the name-level half of check 1.** Extend `validate:comments`
  (its symbol table already spans `modules/`, `tests/`, `scripts/` and root
  JS) to backticked code references in live docs, with the same
  precision-over-recall shapes, so a doc naming a function, constant or dep
  that no longer exists is caught by a gate instead of a reader. Warning
  from round 0, failing from round 10.
- **Round 0 before round 1:** archive the plans whose own status line says
  shipped, and build the gates in warning mode, recording their baselines.
- **Size rounds by lines (~6,000 budget), not doc count.** Rounds 3 and 7
  are split into 3a/3b and 7a/7b; the table now carries a Lines column.
- **"Last Updated" becomes "Last verified"** in check 5.
- **Scope adds the repo-root docs** (`README.md`, `CONTRIBUTING.md`,
  `AGENTS.md`, `CODE_REVIEW_REPORT.md`, round 2) **and the user manual**
  for checks 2 and 6 (round 1). `DRIFT_AUDIT_CHECKLIST.md` records that the
  July 2026 drift review found every one of its copy findings on public
  surfaces; the user manual is the doc users actually read.
- **This plan is audited in round 10**, not round 9 (it sorts into round 9's
  A–L range, which contradicted its own row).
- **Allow-lists for both gates include this plan**: its *Known hot spots*
  quote stale literals on purpose, as dated findings.

Taken (Nov 5 2026, after the round 0 report — MJ: "I agree with all three"):

- **Round 0 signed off;** round 1 may start. Round 0 ships with a release
  (see *Round 0 result*), merged alongside PR #111.
- **One front door.** `_sidebar.md` stays the full map (Docsify renders it
  and `validate:docs` gates its reachability); `INDEX.md` shrinks to a
  ~100-line "start here by task" router; `DEVELOPER_DOCUMENTATION.md` is
  archived into it; `docs/README.md` stays as the site's landing page.
  Done in round 1, which audits all four.

Taken (Nov 5 2026, round 1 report — MJ):

- **User-manual privacy wording** (now matching `legal/privacy.html`): approved.
- **LAN addresses removed** — the two in the archived developer hub, plus the
  same personal address used as the "example" in `GETTING_STARTED.md` and
  `TESTING_QUICK_REFERENCE.md` (now `192.168.1.20`). Git history still holds
  them; they are private-range, so history is not rewritten.
- **`PROJECT_STATS.md` drops its hand-typed claim rows** — Test Pass Rate, DI
  Completion, custom-globals count (and the duplicate Pass Rate row). Other docs
  repeating "Test Pass Rate 100%" (`ARCHITECTURE_OVERVIEW`, `TESTING_README`) are
  fixed in their own rounds (6 and 3b).
- **Games:** not in use; the space in `games/miniCycle- taskGame.html` is fine
  for now. No audit action.
- **Sidebar and INDEX list Start Here in the same order** (1 → 7): what it is,
  how it works, getting started, dev server, first contribution, folder
  structure, framework equivalents.

Open — MJ to decide (a restructure, so the *will NOT do* rule "fix, don't
polish" would otherwise leave it untouched):

- **The two CLAUDE.md files.** The repo-root `CLAUDE.md` (auto-loaded every
  session, "the short summary") and `working-on-code/CLAUDE.md` ("the
  detailed reference") are about the same length with different section
  structures. *Recommended:* root keeps the rules and the read-first routing
  table and moves its incident narratives next to the gates they explain in
  `VALIDATION_GATES.md`; the detailed one keeps only what root does not say.
  Decide before round 4 (`working-on-code/`).

---

*Progress is tracked in the Rounds table above; this plan is archived in
round 10 once the table is all "done".*
