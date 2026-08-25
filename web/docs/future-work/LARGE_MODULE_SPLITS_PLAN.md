# Large Module Splits Plan

**Date:** March 15, 2026
**Updated:** August 21 2026 — four previously-unassessed modules given verdicts; scripts brought into scope (`update-version.sh`); the last inline line counts removed, since the doc had retired them in principle but kept four in practice and all four had drifted. August 2026 — Priority 2 (statsPanel) SHIPPED (commit `806f8082`); line-count table retired (numbers rot — see [PROJECT_STATS.md](../PROJECT_STATS.md)). July 7, 2026 — god-module audit: added statsPanel (Priority 2), orchestrator assessment, false-positive list
**Updated:** Aug 25 2026 — `guidedTourManager` assessed and the "borderline (sequential step content)" row RETIRED: it is **not** a god module (fan-out is 9 infrastructure deps and zero feature modules; one `innerHTML` in 1,962 lines), but half the file is data + repetition, so it opens as **Priority 9 — a dedup, not a split**.
**Updated:** Aug 23 2026 — Priority 1 shipped; Priority 7 stage 1 (CSP hashes) shipped in v2.488 and the `?v=` stage re-scoped after checking what content hashing actually replaced; execution order, DONE condition and the pattern guidance all revised against what the work actually showed.
**Status:** In progress — **Priorities 1, 2, 3 and 6 complete**; Priorities 4 and 5 open but TRIGGER-BASED (do not schedule them), plus 7 (`update-version.sh`, `restore.sh` stage next). **Priority 9 (`guidedTourManager`) OPENED Aug 25 2026 — a DEDUP, not a split: 50% of the file measured as declarative data + twelve near-identical prompt functions; not a god module, but over target and cheaply fixable.** **Priority 8 (`onboardingManager`) OPENED Aug 24 2026; CLOSED Aug 25 2026 — steps 1-3 shipped (v2.499 demo, v2.500 splash, v2.501 carousel): 2,534 → 1,052, eighteen new tests** — a god module the page had mislabelled "borderline" and left unscheduled. Priority 3 CLOSED Aug 24 2026 at 1,636 lines — **above the ~1,500 target, deliberately**; the remaining bulk is the 10-dep undo/redo execution core, recorded as a non-split with evidence. Priority 1 SHIPPED Aug 23 2026 in v2.484 (five extractions, 2,649 → 1,587 lines, 83 new tests). **Aug 21 2026 review:** added a DONE condition (~1,500-line target, everything else trigger-based); rewrote the per-extraction checklist around the gates that caught the two defects the completed splits shipped (`test:sw`, `validate:provides`); corrected the "provides stays the same" promise the statsPanel split falsified; pulled the release script's CSP stage forward from Priority 7
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](../archive/DI_MIGRATION_COMPLETION_PLAN.md), [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md)

---

## Problem

Several modules exceed 1,300 lines and handle multiple distinct responsibilities. Large modules are harder to navigate, test in isolation, and modify without unintended side effects.

### When this plan is DONE (added Aug 21 2026)

Every split buys navigability and pays a permanent tax: a Pattern 1 sub-module is invisible to
`moduleManifests.js` by design, so it needs `FACADE_SUB_FILES` special-casing in `validate:di`, its
own precache entry, and its own test file. That tax is worth paying a bounded number of times, not
indefinitely — and this page has drifted toward expansion (scripts came into scope Aug 21 2026; four
more modules were assessed the same day).

**Target:** no non-data module over ~1,500 lines. `defaultLabels.js` and `constants.js` are
permanently exempt — they are data, and centralizing them is an explicit project rule.

**But judge by SEAM WIDTH, not the line count.** Priority 1 tested this directly. Mid-way
through, the remaining clusters were assessed as unextractable and the ~1,500 target declared
unreachable for that file — a verdict that was wrong, and wrong for an instructive reason: the
cost had been priced as a **callback bag** (7 callbacks + 2 bindings) when the codebase's
actual pattern for stateful sub-modules is statsPanel's **manager back-reference**, which needs
no interface at all. Re-grouping (inline edit moved WITH CRUD) then narrowed it further. The
file landed at 1,587.

So: a wide seam is a real reason to stop, but price it against the pattern the app ALREADY
uses before concluding it is wide. And when a cluster is genuinely inseparable — state the
parent persists and reads, plus many call-backs — record it as a non-split with the evidence,
as Priority 1 does for search/sort/filter.

**Everything not required to hit that target is trigger-based, not scheduled.** The orchestrator
entry already has the right shape ("do it opportunistically next time boot timing is touched"); the
Priority 4/5 entries (`recurringPanel`, `taskDOM`) and the deferred list should be read the same
way. Re-open a trigger-based item only when its module gains a *second user-facing domain*, not when
it gains lines.

Reaching the target closes this plan. Do not add candidates to keep it alive; open a new one if the
codebase genuinely drifts again.

**Amendment, Aug 24 2026 — the target is a heuristic, and Priority 3 closed above it.**
`undoRedoManager.js` was closed at **1,636** lines, not ~1,500. That is consistent with the rule
directly above, not an exception to it: what remains is `performStateBasedUndo` (197) and
`performStateBasedRedo` (189), carrying **10 dependencies each**. Cutting into them to buy ~136
lines would trade a wide seam for a number, which is the failure this section exists to prevent.
Recorded as a non-split with evidence, exactly as Priority 1 did for search/sort/filter.

So a priority closes when its seams are exhausted, not when a line count is met. Twelve non-data
modules remain over 1,500 and **every one already carries a verdict** — deferred (`moduleLoader`,
`migrationManager`), not-a-god-module (`taskViewLayoutManager`, `quickActionsManager`), already
split and trigger-based (`taskDOM`, `recurringPanel`, `notifications`, `routineSwitcher`), or
— until Aug 25 2026 — borderline-and-unscheduled (`onboardingManager`, `guidedTourManager`). All
three of those labels have since been replaced by measured verdicts (see the sections below):
`preferencesManager` is **not** a god module, `onboardingManager` **is** one and became Priority 8
(closed), and `guidedTourManager` is **not** one — but it is over target for a reason the target can
still fix, so it opens as Priority 9.

Note what Priority 9 is *not*: **the remedies on this page are not all splits.** A module can sit
over 1,500 lines because it repeats one job rather than spans several, and the correct fix is then a
declarative table — the `settingsUIManager` finding, applied for the first time.

This doc no longer pins line/dep/method counts — every measured number in the previous revision of this table had drifted by August 2026. For current volatile metrics see [PROJECT_STATS.md](../PROJECT_STATS.md); for a specific module, measure it fresh (`wc -l`) before extracting. Candidates by verdict:

| Module | Verdict |
|--------|---------|
| routineSwitcher.js (`modules/routine/`) | **God module** — Priority 1 — ✅ **SHIPPED** v2.484 (2,649 → 1,587; five sub-modules; see below) |
| onboardingManager.js | **God module** — Priority 8 — ✅ **CLOSED** v2.501 (2,534 → 1,052; three sub-modules, 18 new tests; see below) |
| undoRedoManager.js | **Priority 3** — ✅ **CLOSED** v2.498 (2,306 → 1,636; three sub-modules, 53 new tests; execution core is a recorded non-split — see below) |
| statsPanel.js (`modules/features/`) | **God module** — Priority 2 — ✅ **SHIPPED** (commit `806f8082`, see below) |
| guidedTourManager.js | Not a god module — **repetition + data, not spread** — but over target: **Priority 9, a dedup not a split** (assessed Aug 25 2026; the "sequential step content" label was measurably false — see below) |
| recurringPanel.js | Already split (5 sub-modules) |
| taskDOM.js | Already split (6 sub-modules) |
| moduleLoader.js | Deferred (boot infrastructure) |
| migrationManager.js (`modules/routine/`) | Deferred (working code) |
| orchestrator.js | Deferred (see below) |
| notifications.js (`modules/utils/`) | **Priority 6** — ✅ **SHIPPED** (v2.463; `EducationalTipManager` → `utils/educationalTips.js`) |
| taskViewLayoutManager.js | Not a god module — one feature, low fan-out (assessed Aug 21 2026) |
| quickActionsManager.js | Not a god module — one feature (assessed Aug 21 2026) |
| settingsUIManager.js | Not a god module — **repetition, not spread** (assessed Aug 21 2026) |
| preferencesManager.js (`modules/ui/`) | Not a god module — **already split, and what remains is one domain with wide seams** (assessed Aug 24 2026) |
| `scripts/update-version.sh` | **Candidate — Priority 7**, and the highest blast radius on this page (see Scripts, below) |

Note: routineSwitcher grew ~500 lines between March and July 2026 (inline-edit modal, recently-used rendering, routine selection, data validation/repair). It is growing fastest of the candidates — another reason it stays Priority 1.

---

## July 2026 God-Module Audit — Methodology & Verdicts

Line count alone over-flags. The audit combined three signals: **size** (lines), **fan-out** (DI deps declared), and **responsibility spread** (distinct method clusters). A module qualifies only when all three are high AND the responsibilities span multiple user-facing feature domains.

**Confirmed god modules (2):**
- `routineSwitcher.js` — six distinct jobs: switcher modal lifecycle, routine CRUD (rename/delete/duplicate/download), inline editing, vocab theme picker, preview pane + popout review modal, list infrastructure (search/sort/filter/recently-used/storage bar/validation-repair).
- `statsPanel.js` — at audit time, highest method count in the codebase (~61). Gesture *detection* was already extracted to `gesturePanelManager`, but statsPanel still hosted ~12 gesture handler-method bodies (touch/mouse/pointer/wheel/keyboard), plus stats rendering, theme-unlock logic, nav dots, and launcher code for four other modals. **✅ Since split — see Priority 2 below (shipped).**

**Borderline (not scheduled):** `onboardingManager.js`, `guidedTourManager.js` — big but inherently sequential step content; long ≠ god unless they accrete non-onboarding work. `recurringPanel.js` — already split; see Priority 4.

> **Retracted Aug 25 2026 — both halves of that call were wrong, and neither was ever measured.**
> `onboardingManager` *was* a god module (Priority 8, closed). `guidedTourManager` is *not* one — but
> not for the reason given: it holds **one** `innerHTML` in 1,962 lines, because tour copy lives in
> `defaultLabels.js` behind `messageKey` references. "Sequential step content" described neither file.
> The lesson is narrower than "that audit was sloppy": **one label applied to two modules at once is a
> guess about both.** Measure each, or leave the row blank.

**Not god modules (false positives a size/dep-count tool will flag):**
- **The four facades** — `settingsManager` (35 deps), `taskCore` (29), `taskDOM`, `preferencesManager`: high dep counts are the point of the facade pattern; they wire sub-modules. Intentional.
- **Data files** — `defaultLabels.js`, `constants.js`: pure data; centralizing them is an explicit project rule. Both are larger than most modules on this page and always will be — that is the design, not drift.
- **Orchestrators with high fan-out but one job** — `taskCycleReset.js`, `menuManager.js`: cycle reset and the main menu touch everything by nature. High fan-out, single purpose.
- **Boot infrastructure** — `moduleLoader.js`, `moduleManifests.js`: centralization is the design.
- **`migrationManager.js`** — previously ruled acceptable (working write-once code).

---

## August 21 2026 — Four Modules the Audit Had Never Assessed

Three of these post-date the July 2026 audit; one predates it and was simply missed. All four are
now among the ten largest files under `modules/`, so their absence made the candidate table read as
complete when it was not. Verdicts use the same three signals — size, fan-out, responsibility spread
— and the same rule: a module qualifies only when **all three** are high AND the responsibilities
span multiple user-facing domains.

### `notifications.js` — Priority 6 — ✅ SHIPPED (v2.463)

The only one of the four that qualifies, and it comes with its seam already drawn: the file holds
**two classes**, `EducationalTipManager` and `MiniCycleNotifications`. The tip manager is a distinct
feature — teaching moments tied to app state — that happens to live in the notifications file
because tips are delivered as notifications. Delivery mechanism and pedagogy are different jobs.

**Outcome (v2.463).** `EducationalTipManager` (210 lines) moved to
`modules/utils/educationalTips.js`; `notifications.js` went 1,928 → 1,741 and keeps a
**re-export** so the test harness and every existing importer reach the class unchanged.
The extraction was as clean as predicted — one coupling point, `new EducationalTipManager(() => this.deps)` —
but three things surfaced that a size-and-class-boundary read did not predict, and they are
the reusable lesson for the remaining splits:

1. **A module-scoped helper came along invisibly.** The class called `_safeAddEventListener`,
   defined in `notifications.js` and closing over its `_deps` proxy. Scanning for "what does
   this class reference" with a guessed list of names missed it; **ESLint's `no-undef` caught
   it**. The fix takes deps explicitly rather than importing the twin back — a circular ESM
   edge between two BOOT_CRITICAL modules is not worth saving four lines.
2. **The re-export is a silent seam.** Dropping `export { EducationalTipManager }` throws
   nothing at the source: importers get `undefined`, and the harness's
   `window.EducationalTipManager = mod.EducationalTipManager` quietly assigns it. Guarded now.
3. **The deps getter is load-bearing and easy to "simplify" away.** Capturing deps by value at
   construction passes 46 of 47 tests — everything except the one written for it. Late-injected
   deps would simply never arrive.

Fan-out is moderate rather than alarming, which is why this was Priority 6 and not higher: the size
comes from one large class, not from wiring breadth. Extract `EducationalTipManager` first — it is
already class-boundaried, so the extraction is a move rather than a carve.

### `onboardingManager.js` — GOD MODULE — Priority 8 (assessed Aug 24 2026)

**The previous verdict was wrong.** This page called it "borderline (sequential step content)" and
left it unscheduled. Measured: **13 lines** of template-literal HTML in 2,534 lines, across
43 methods. It is not step content. It is **four distinct interactive subsystems** in one file:

| Subsystem | Lines | deps | calls out | Seam |
|---|---|---|---|---|
| Interactive demo (`_startInteractiveDemo`, `_buildCycleDemo`, `_buildTryItDynamic`) | 470 | 1 | **1** | **narrow** |
| Welcome carousel (`_showFirstRunWelcome` + 4) | 466 | 1 | 11 | wide — calls INTO the demo |
| First-run splash (`_showFirstRunSplash`, `_hideFirstRunSplash`) | 247 | 1 | 3 | narrow |
| Onboarding modal + completion | ~324 | — | — | the residual facade |

**Start with the interactive demo.** 470 lines reaching ONE sibling method
(`_setFirstRunWelcomeMessageText`) and one dependency — a narrower seam than `undoIndexedDB` had,
and more than three times the size. The splash is a viable second. Take the welcome carousel LAST
or not at all: it calls into the demo cluster, so extracting it first creates a sub-module edge
for no reason.

#### ✅ Step 1 SHIPPED — `onboardingDemo.js` (v2.499)

Re-measured before extracting, exactly as this page instructs, and every number above held:
2,534 lines, 470 in the cluster, **one** outbound sibling call, **one** dep (`AppState`), no
instance state beyond `this.deps`. Result: **2,534 → 2,065**, sub-module 512, six new tests.

Pattern 1 with the **manager back-reference** (`this.m`), as Priority 1 recommends — the seam
needed no interface at all, just two ownership rewrites.

Two things worth carrying to the remaining steps:

1. **Load point is forced by the CALLER, not the cluster.** The obvious choice was a lazy import
   at the demo's own entry point, which would keep 470 lines out of the boot graph. It doesn't
   work: the welcome carousel renders two of these builders from **synchronous** slide callbacks,
   so there is no await to hang an import on. Loaded in `init()` instead. Check how a cluster is
   *reached* before deciding where to import it.
2. **The delegating call sites are unguarded on purpose.** `this._demo._buildCycleDemo(container)`,
   not `this._demo?.…` — per CLAUDE.md rule 19. A missing sub-module must throw and name itself
   rather than render an empty slide, which is the failure the v2.481 seam audit spent a release
   chasing.

#### ✅ Step 2 SHIPPED — `onboardingSplash.js` (v2.500)

Splash cluster measured at **329** lines (the estimate above said ~247 — it counted two methods,
not five). Seam again narrow: ONE outbound sibling call (`_scheduleFirstRunWelcomeAdvance`) and
ONE dep. **2,065 → 1,764**, sub-module 350, six new tests.

State was deliberately NOT migrated: the seven `_firstRunSplash*` fields stay on the manager and
are reached via `this.m`, so `destroy()` still clears every timer it always cleared.
`showWelcomeSplash()` and `_hideFirstRunSplash()` stay on the manager as thin delegators — appInit
calls the first and two test files reach for both, so moving them would have been an API change
dressed as a refactor.

**The load-point rule from step 1 was WRONG, and this step proved it.** Step 1 concluded "load in
`init()`". Applied to the splash that broke **14 existing tests** at once: they construct the
manager directly and never await `init()`, so `this._splash` was null on every synchronous entry
point — and `_showFirstRunSplash` is reached from appInit, not from an awaited path.

The fix is the precedent already in CLAUDE.md: **static import, constructed in the constructor**,
exactly as `notifications` → `educationalTips`. There is no async init to hang a dynamic import on
when the entry points are synchronous, and content-hashed builds (since v2.301) mean `?v=` buys
nothing. Both sub-modules were switched.

**So the rule for the remaining steps is:** if a cluster's entry points are synchronous, use a
STATIC import and construct in the constructor. Dynamic-in-`init()` is only correct when every
caller is downstream of an awaited init — which is rarer here than it looks. A dynamic import
leaves a window where the sub-module is null, and that window is exactly the silent-feature-loss
this codebase keeps paying for.

#### ✅ Step 3 SHIPPED — `onboardingCarousel.js` (v2.501) — PRIORITY 8 CLOSED

Carousel measured at **740** lines across **15** methods; the estimate said ~466 across 5. One
contiguous region, so it moved in a single block. **1,764 → 1,052** — under the ~1,500 target.

Its 22 instance fields stayed on the manager, as the splash's did. Two methods kept **thin
delegators** on the manager — `_scheduleFirstRunWelcomeAdvance` (called by `onboardingSplash`) and
`_setFirstRunWelcomeMessageText` (called by `onboardingDemo`). That was the point: sibling
sub-modules keep addressing the MANAGER, so neither of them needed a single line changed, and there
is no sub-module-to-sub-module edge to maintain. One hop, not two.

The old "carousel last or not at all, because it calls INTO the demo" caution turned out to be
spent once the demo was already out: that call is an ordinary `this.m` hop.

**Priority 8 total: 2,534 → 1,052 across three sub-modules and eighteen new tests**, in a file that
had no coverage for any of the three clusters.

#### What the three steps cost in mistakes, recorded because the next split will hit them

1. **Step 1's load-point rule was wrong** and step 2 disproved it — see above. Static import,
   constructed in the constructor, whenever entry points are synchronous.
2. **Range-based moves sweep the NEXT method's JSDoc.** Three lost in step 1, four caught
   pre-emptively in step 2, one misplacement in step 3 (delegators inserted between a docblock and
   its getter). Now checklist step 6b.
3. **Two tests asserted contracts that did not exist.** Step 1's "deps are read live" passed
   against a deliberately capturing constructor; step 3's "message setter is inert with no element"
   asserted a null guard the method has never had and should not have (rule 19 — a guard there
   hides broken wiring). Both were caught by mutating, not by reading. **Mutate every new test in a
   split**: a test that cannot fail is worse than no test, because it reads as coverage.
4. **`validate:comments` rejects glob identifiers.** ``_firstRunWelcome*`` in a header comment
   fails the gate — name a real field or drop the backticks.

**Remaining in the file (~1,052):** the onboarding modal, `setupModalControls`,
`completeOnboarding`, `_scheduleStartTourFlow`, lifecycle and `destroy`. That is the residual
facade — one domain, and the target is met. **Priority 8 is closed.**

**Do not repeat the Priority 3 mistake** of scheduling the biggest *function*. Measure neighbours.

### `preferencesManager.js` — NOT a god module (assessed Aug 24 2026)

2,027 lines, but it has **already been split**: a Pattern 1 facade dynamic-importing
`preferencesBgImage.js` (549) and `preferencesPresets.js` (807), so 1,356 lines are already out.
What remains is one domain — the preferences panel — and its seams are wide.

The only real cluster is **custom colours** (`resetAllColors`, `loadSavedColors`, `updatePreview`,
`resetColor`, `applyCustomColors`): 525 lines, but it calls out to **9** sibling methods
(`applyPatternWithCurrentSettings`, `isDefaultTheme`, `isPatternCustomizable`, `pushToUndoStack`,
`saveColor`, `removeCustomColors`, `removePatternColor`, `updatePatternControlsVisibility`,
`normalizeHexInput`). Nine outbound calls is the callback-bag shape Priority 1 warns about, and
unlike Priority 1 there is no manager back-reference to fall back on here — the sub-modules use
the dynamic-import pattern, not `this.m`.

**The real problem is a method, not a module.** `setupEventListeners` is **459 lines** — 23% of
the file — with 65 branches across 25 distinct `DOM_IDS`, yet only 3 listener registrations. That
is conditional wiring logic that grew, and the fix is extracting methods **in place**, not carving
out a file. Trigger-based: do it next time that method is touched for another reason.

### `taskViewLayoutManager.js` — NOT a god module

High on size, **low on fan-out**, and it does exactly one thing: the drag-to-reorder layout for the
task view. Long because dragging is fiddly — pointer maths, snap targets, coalesced writes — not
because it accreted unrelated work. This is the case the methodology exists to protect: a size-only
tool flags it, all three signals together do not.

### `quickActionsManager.js` — NOT a god module

One feature domain (the Quick Actions panel: slots, picker, views, tooltip), moderate fan-out. Its
usage-tracking concern was **already extracted** to `actionUsage.js`, which is the split this module
needed and has had. Re-examine only if it grows a second user-facing domain.

### `settingsUIManager.js` — NOT a god module, but a real problem of a different kind

This one scores highest of the four on every raw signal — most deps, most methods, most exports —
and is nonetheless **not** a god module, which makes it the most instructive entry here.

It is **23 near-identical `setupXToggle()` functions** plus `initAllToggles()`. Every signal is
inflated by repetition of one job, not by spread across jobs: the dep count is high because each
toggle needs its own bits, and the export count is one per toggle. Splitting it would produce two
files of the same repetition.

The fix it actually wants is a **declarative toggle table** — id, settings key, default, optional
side-effect — with one generic wiring function, so adding a setting is a row rather than a
function. That is a different refactor from anything else on this page, and it is worth recording
here precisely so nobody "solves" this file by cutting it in half.

Note also what it is: a **sub-module of the `settingsManager` facade** that has itself grown to near
the size of the modules the facade pattern was meant to tame. Extracting into sub-modules moves work
rather than shrinking it; sub-modules need re-measuring too.

---

## August 25 2026 — `guidedTourManager.js`: NOT a god module — Priority 9, a **dedup**, not a split

Measured on `7f043d7b` (v2.502): **1,962 lines.** This entry exists because the candidate table
carried an unverified label from the July 2026 audit until now, and because the fix this file wants
is the one `settingsUIManager` describes but nothing on this page had yet executed.

### The three signals

**Size — high, but half of it is not code.**

| region | lines | % | kind |
|---|---:|---:|---|
| header / DI / constructor | 113 | 5.8% | — |
| `_register*Tour()` × 13 | **536** | 27.3% | **declarative data** |
| lifecycle: init / start / step nav / destroy | 397 | 20.2% | engine |
| `show*TourNotification()` × 12 | **443** | 22.6% | **repetition** |
| persistence + reduced-motion | 42 | 2.1% | engine |
| DOM build / render / position | 176 | 9.0% | engine |
| runtime listeners + focus trap | 255 | 13.0% | engine |

**979 lines — exactly 50% — are data and repetition.** The engine is ~980.

**Fan-out — low.** Nine required deps plus one optional, and every one is infrastructure:
`AppState`, `showNotification`, `safeAddEventListener`, `appInit`, five DOM accessors,
`isModalOpen`. **Zero feature-module dependencies.** Twelve tours cover twelve user-facing domains
and the module imports from none of them — it resolves selectors and reads `settings[stateKey]`.
Its only state writes are `_persistStep` / `_markDone`, each writing a single key.

**Responsibility spread — low.** The four engine clusters are one job: run a spotlight tour
(position tooltip, trap focus, persist step, tear down). The twelve domains are *subjects* of the
tour, not work the module performs. This is the distinction the methodology turns on:
`routineSwitcher` actually performed routine CRUD and theme picking; this file talks *about* stats
and reminders without doing either.

Two of three signals are low, so it does not qualify. **Not a god module.**

### It is the `settingsUIManager` shape, and this was measured, not eyeballed

All twelve `show*TourNotification` bodies were normalized (tour ids, label strings and selectors
stripped) and diffed line-set-wise against `showStatsTourNotification`:

- **Ten of twelve are line-for-line identical** apart from the tour id, the label prefix, and one
  inner container selector.
- `showMenuTourNotification` differs by **2 lines** (no dialog container — the menu is a `<nav>`).
- `showStatsTourNotification` is the only genuinely different one: two extra guards
  (`cyclesCompleted >= 1`, `!focusModeActive`).

395 non-blank lines expressing one function with a per-tour selector — precisely what the
`settingsUIManager` entry above warns must not be "solved" by cutting the file in half.

The sharper point: **guidedTourManager already has the table.** `this._tours` is a `Map` keyed by
tour id, and the file still hand-writes twelve registrars and twelve openers around it. The
declarative structure exists; the code just doesn't read from it.

### The real cost is not the line count — it is the per-tour tax across six files

Adding one tour today touches **six files**: the module (registrar + opener),
`moduleManifests.js` `provides` (14 names, twelve of them `show*TourNotification`),
`moduleLoader.js`'s hand-written `depMappings` table, the consumer's `optional(null)` declaration,
the consumer's call site, and `defaultLabels.js`. Miss the `depMappings` line and the tour silently
never prompts — the exact failure family `validate:api` was written for.

Neither Priority 9 move changes that tax: the public API stays twelve names, so all six layers stay.
What the moves buy is that the twelfth tour stops costing ~37 lines of copied body inside the module
— the wiring cost is structural and is not what this page can fix.

### Priority 9 — two moves, neither a Pattern 1 split

No new facade, no `FACADE_SUB_FILES` entry, no new `provides`, no change to any of the five wiring
layers.

1. **Generic `_showTourPrompt(tourId)` + twelve thin public wrappers.** Public API unchanged — all
   fourteen `provides` names survive, so `validate:provides` and `validate:api` see no diff. The
   per-tour differences become fields on the tour definition (`promptContainerSelector`,
   `minCycles`, `mainViewOnly`). ≈443 → ≈130 lines.
2. **Tour definitions → a data module.** 536 lines out. `defaultLabels.js` and `constants.js` are
   already permanently exempt as data, so this is consistent with the project rule rather than an
   exception to it.

Combined: **≈1,116 lines**, under the ~1,500 target.

### Two costs recorded honestly, because move 2 is not mechanical

- **Sixteen steps carry `onEnter` closures that read `this.deps`.** Fourteen are one of two shapes
  — "skip if the element isn't visible", varying only by selector and visibility predicate — so a
  pure-data module requires making the predicate declarative
  (`skipIfHidden: { type, target, check }`) with the engine interpreting it. That is a design
  decision, not a move. If it turns out ugly in practice, ship move 1 alone (≈1,650 lines) and
  record move 2 as a non-split with evidence, the way Priority 3 did for the execution core.
- **`guidedTourManager.js` is in `BOOT_CRITICAL`** (`service-worker.js`). A statically imported
  data module becomes boot-critical too and needs its own entry — `test:sw`'s precache drift guard
  is the gate, and it is the one gate `npm test` cannot substitute for.

### Do this before trusting any other unverified row

The two things this assessment overturned were both *labels*, not measurements: "sequential step
content" (false — one `innerHTML`) and "borderline" (false in both directions, on both modules it
was applied to). Every remaining verdict on this page that was reached by reading rather than
measuring deserves the same treatment before it is acted on.

---

## Scripts — In Scope As Of August 21 2026

This plan covered `modules/` only. That excluded the **second-largest file in the repository**.

### `scripts/update-version.sh` — CANDIDATE (Priority 7)

Larger than every module except `defaultLabels.js`, and structurally unlike anything else here:
roughly **30 labelled stages and only four functions**. It is a linear procedure, so almost none of
it is callable — and therefore almost none of it is testable — in isolation.

**Why it belongs on this page despite not being a module:** blast radius. It is the release gate.
Every app-code change ships through it, and a bug in it does not fail loudly — it produces a
half-dark deploy. That is not hypothetical: an August 2026 review found a `$SCRIPT_DIR` reference
that belonged to a generated `restore.sh` heredoc being read as if it were the script's own
variable. Under `set -euo pipefail` that would have aborted **every release** until someone
diagnosed it.

**The pattern already exists here, and it worked.** The changelog-range logic was extracted to
`scripts/changelog-range.sh` and immediately gained `scripts/test-changelog-range.sh` — five tests,
including the boundary case that had shipped three wrong changelogs. That is the model: a stage
becomes a script, and a script can have tests.

Best candidates, by the same "most isolated first" ordering used above:

1. ~~**CSP hash regeneration**~~ — ✅ **SHIPPED v2.488** as `scripts/csp_hash_sync.py` +
   `scripts/test-csp-hash-sync.py` (17 cases, wired to `npm run test:csp-sync` and CI).
   update-version.sh 2,528 → 2,424. Equivalence was proven rather than assumed: both the old
   heredoc and the new module were run against deliberately perturbed configs and the three
   outputs diffed byte-for-byte. The tests immediately earned themselves — they caught a bug in
   the extraction itself, where `discover_html_sources(root)` returns paths relative to `root`
   while `generated_script_hashes` opens them relative to the CWD. Those agree in production
   (`cwd == web/`, `root == '.'`) and diverge anywhere else, so the fixture silently hashed the
   REAL `miniCycle.html`. Invisible in production; fatal to any test.

2. **`restore.sh` generation** — self-contained, and the heredoc quoting is precisely where the
   `$SCRIPT_DIR` bug lived. Now the next candidate.

3. **The `?v=` cache-buster sweep** — **RE-SCOPED Aug 23 2026, and demoted.** This was listed on
   the rationale that it is "a pure text transform over a file list". The transform part is still
   true; the IMPORTANCE is not. Since v2.301 the JS entries and the CSS bundle are content-hashed
   (`/build/…`, `build/styles/main-*.css`), so the sweep is no longer the app's cache-busting
   mechanism. What still legitimately depends on it is narrow:

   - `version.js?v=` — a live production request that MUST stay query-busted, because it is the
     file publishing `APP_VERSION`; a content-hashed name cannot be resolved before the version
     it declares has been read.
   - `?v=${APP_VERSION}` on dynamic sub-module imports.

   Note also that `CLAUDE.md` claimed "`?v=` is dev-only" until Aug 23 2026 — it is not, and that
   sentence has been corrected. And the sweep still rewrites
   `<!-- <link rel="stylesheet" href="miniCycle-styles.css?v=…"> -->` in `miniCycle.html` on every
   release: a COMMENTED-OUT link to a file that 404s in production, superseded by the hashed
   bundle. Deleting that comment removes a file from the sweep's surface and is the cheaper fix
   than extracting the stage.

**Sequencing correction (Aug 21 2026): "not urgent" contradicted the blast-radius argument above,
so stage 1 moves up.** This section simultaneously called the release script "the highest blast
radius on this page" and deferred it to last. Both cannot be true. The evidence favours the first
reading — recent releases surfaced two live defects in this script, neither of which failed loudly:

- it pushed the tag even when the branch push was **rejected**, leaving a tag pointing at a commit
  the remote did not have (fixed; verified since by checking `git rev-list --left-right --count`
  after every `--push`);
- with a dirty tree it wrote a literal `TODO(changelog)` line into a **shipped** release, needing a
  follow-up docs commit to repair (fixed by `--note` / the interactive prompt).

So: **CSP hash regeneration is pulled forward to slot 2 in the execution order** — it is already
glue around a Python validator, which makes it the cheapest possible instance of the
`changelog-range.sh` pattern this section cites as the model. The remaining stages (`?v=` sweep,
`restore.sh` generation) stay at the back and stay trigger-based: do them the next time a release
bug costs an afternoon.

## Established Sub-Module Patterns

The codebase already has two proven patterns for splitting modules. Any new splits must follow one of these.

### Pattern 1: Dynamic Sub-Module Loading

Used by: `taskDOM.js` (6 sub-modules), `recurringPanel.js` (5 sub-modules), `settingsManager.js` (5+ sub-managers), `statsPanel.js` (2 sub-modules — the shipped Priority 2 split)

```javascript
// In parent module's init() or constructor:
const version = this.deps.AppMeta?.version || '1.0';

const [fooMod, barMod] = await Promise.all([
    import(`./parentFoo.js?v=${version}`),
    import(`./parentBar.js?v=${version}`),
]);

this._foo = fooMod;
this._bar = barMod;
```

Rules:
- Sub-modules do **NOT** get their own manifest entry — they're internal to the parent
- Parent's `provides` list stays the same — the public API doesn't change
- Sub-modules may have their own `createDIModule()` DI setup (e.g., taskRenderer.js, taskButtons.js) — the parent calls their `setDependencies()` after import
- Must use `?v=${version}` on all dynamic imports (see constraint below)

### Pattern 2: Pure Utility Extraction

Used by: helper modules with no module-level side effects (no DI, no state, no `addEventListener`).

```javascript
import { helperFunction } from './parentHelpers.js';
```

Rules:
- Safe for static import ONLY if the file has zero side effects
- No `setDependencies()`, no module-level state, no event listeners

### Critical Constraint: Versioned Import Split Bug

`import('./foo.js?v=1.0')` and `import './foo.js'` create **separate module instances** in the browser. If a module has side effects (DI setup, module-level state), the static import creates an unversioned instance that diverges from the versioned one loaded by moduleLoader.

**Rule:** Anything with side effects must use dynamic versioned imports. Pure utility functions are the only safe static imports.

---

## Priority 1: routineSwitcher.js — ✅ SHIPPED (v2.484, Aug 23 2026)

**2,649 → 1,587 lines (−40%)**, five sub-modules, and **83 tests over code that had none**.
The family totals 3,088 lines — MORE than the 2,649 it started as. That increase is module
headers and JSDoc, not duplicated logic; the metric that mattered was the largest single file.

| Sub-module | Lines | Tests | Pattern |
|---|---|---|---|
| `routineSwitcherActions.js` | 712 | 15 | manager back-reference (`this.m`) |
| `routineSwitcherPreview.js` | 304 | 16 | static import, `fn(deps, callbacks)` |
| `routineSwitcherThemePicker.js` | 198 | 17 | static import, `fn(deps, …)` |
| `routineSwitcherRepair.js` | 152 | 17 | static import, single dep |
| `routineSwitcherListTransforms.js` | 135 | 18 | static import, pure functions |

Commits: `60b721a5` (theme picker), `148322eb` (preview), `af99748a` (list transforms),
`3f458f26` (repair), `997700f4` (actions).

### What the plan got wrong, and what that cost

**Every extraction was preceded by tests written against the PRE-split code.** That is now
the non-negotiable step — it caught four wrong assumptions before the move and one real
break after it:

- `onCycleDeleted` / `onCycleRenamed` are awaited with `.catch()`, so a mock returning
  `undefined` throws;
- duplicate increments `state.metadata.totalCyclesCreated`, NOT `userProgress`;
- `_commitRename(oldKey, rawNewName, oldName)` takes **three** args and **re-keys** the
  cycle (`cycles[newName] = …; delete cycles[oldKey]`) rather than just retitling;
- uniqueness is enforced on the storage KEY, not the display title — two routines can end
  up showing the same title;
- after the actions move, `adjustStorageEstimate` and `updateStorageBarUIEstimated` were
  still unqualified and threw. Nothing but the pre-written tests would have caught it, and
  the symptom would have been "delete silently does nothing".

**The method lists in this plan had rotted.** `_updateDesktopPreview` no longer existed and
`_resetDesktopPreview` had become `_resetPreview`. Measure the cluster fresh; treat any
method list here as orientation, not a work list.

**Clusters are not contiguous.** `updatePreview` sat ~95 lines from the rest of the preview
cluster with selection infrastructure in between. Extract by signature, not by line range.

**Grouping changes the seam width.** CRUD looked like a 7-callback interface until inline
edit was moved WITH it — rename flows straight into `_startInlineEdit`, so pulling them
together made two of those callbacks internal and left **four**.

### The pattern decision that matters

The plan assumed Pattern 1 (dynamic `?v=` import) for all three original clusters. That was
wrong for every one of them, for the same measured reason: **`routineSwitcher.tests.js`
constructs `new RoutineSwitcher(mockDeps)` 19 times without calling `initRoutineSwitcher`.**
This file loads dynamic imports INSIDE that init, so a dynamically-loaded sub-module is
`null` on every one of those paths and its methods silently no-op.

All five therefore use **static imports**, which is safe because none holds module-level
state — the theme picker's state lives on the DOM element (`picker._clickHandlers`), and the
others are stateless. Precedent is in the parent already: `keyboardNav`, `mcycPayload` and
`longPressHint` are static imports there, and `longPressHint` both attaches listeners and
carries module state. The versioned-import rule exists to prevent instance-splitting; a
stateless module cannot split.

`routineSwitcherActions.js` additionally uses **statsPanel's manager back-reference**
(`constructor(manager) { this.m = manager }`), because it needs the parent's deps, selection
state and two dynamic-import bindings. It is registered in `FACADE_SUB_FILES` in
`scripts/validate-di-deps.js` so its `this.m.deps.*` reads count as the parent's usage —
without that entry `validate:di` reports them as undeclared.

### What deliberately STAYED, and why

Not everything large is separable. These are recorded as **non-splits** so nobody
"solves" them later:

- **Search/sort/filter UI** (~168 lines) — `setupSearchInput`, `filterRoutineList`,
  `setupSortControls`, `_updateSortButtonStates`, `setupFilterControls` own `_sortMode`,
  `_sortDirection` and `_filterMode`, which the parent **persists** in `_savePreferences`
  and **reads** when rendering the empty-list message. They call back into the parent 14
  times. Only the three pure transforms were separable.
- **Switching** (~262 lines) — the module's actual job.
- **Modal lifecycle** (~132 lines) — core.
- **Fallbacks** (~20 lines) — too small to warrant a module. NOTE: an earlier revision of
  this plan sized these at 121 lines from a "everything until the next method" heuristic,
  which inflates the last method in any run. Brace-match when measuring.

Two cleanups noticed but not done (they are not extractions): `fallbackAddListener` in
routineSwitcher is dead code, and `fallbackNotification` has an empty body, so a missing
`showNotification` would silently swallow every notification from this module.

---

## Priority 2: statsPanel.js — ✅ SHIPPED (commit `806f8082`)

Shipped in full via Pattern 1 (dynamic versioned sub-module imports). `modules/features/statsPanel.js` (note: `features/`, not `ui/`) is now a ~1,353-line facade (as of v2.412) with two sub-modules in the same directory:

- **`statsPanelGestures.js`** (~384 lines as of v2.412) — the gesture handler bodies, as planned
- **`statsPanelRewards.js`** (~259 lines as of v2.412) — the vocab-theme-unlock/rewards concern. **Shipped name differs from the plan's proposed `statsPanelThemeUnlocks.js`.**

Two proposal-vs-shipped deltas worth remembering:

1. The alternative floated for gestures — merging handler bodies INTO `gesturePanelManager` so there'd be one gesture home — was evaluated and **NOT taken**; handlers stayed statsPanel-side in their own sub-module.
2. Unlike the other facades' `wireSubModuleDependencies()` pattern, statsPanel's sub-modules hold a back-reference to the manager (`this.m`) and reach deps via `this.m.dependencies` / `this.m.rawDeps` — `validate:di` scans them via `FACADE_SUB_FILES`. See [HIDDEN_CODEBASE_INSIGHTS.md](../working-on-code/HIDDEN_CODEBASE_INSIGHTS.md).

Remaining statsPanel.js keeps view lifecycle, stats rendering, caching, modal launchers, and preferences — as the plan intended.

---

## Priority 3: undoRedoManager.js — ✅ CLOSED (Aug 24 2026, v2.495–v2.498)

**Shipped, three passes:** `undoIndexedDB.js` (persistence, Pattern 1 static),
`undoSnapshotUtils.js` and `undoTransactionDiff.js` (both Pattern 2, pure).
**2,306 → 1,636 lines**, 670 extracted, 53 new tests.
**Open:** the undo/redo execution core — see the non-split note at the end.

### Pass 3: the change describer (Aug 24 2026)

`computeTransactionDiff` (145) + `describeChange` (131) moved out: 276 lines that touch no
`_deps` **and no globals** — no `localStorage`, `document`, `window` or timers. Neither is in
`provides`; neither is used outside the module.

**"No deps" is not "pure."** `saveToUndoCache` / `loadFromUndoCache` also report zero deps and
were deliberately LEFT in the parent because they touch `localStorage` directly. Grouping them
in would have made the module header's side-effect-free claim a lie. Check globals, not just
the DI surface.

**One honest caveat on the extracted pair:** `describeChange` resolves user text through
`getLabel()`, which is vocabulary-theme sensitive. Same input, same output *for a given theme* —
so its tests assert shape (non-empty, mutually distinct) rather than literal wording.

### The second pass inverted the plan's proposal

Priority 3 scheduled **`captureStateSnapshot`** for extraction. Measured, it is the least
extractable function in the file: 120 lines across six phases — 35 lines of admission guards,
a 9-line self-heal that fire-and-forgets `onCycleSwitched()` and returns, 19 lines of
construction, 22 of dedup, 17 of stack commit, and 13 of side effects (`updateUndoRedoButtons()`
plus a debounced durable write). It reads and writes `AppGlobalState` throughout.

The functions AROUND it were the cluster: `validateSnapshot`, `sanitizeSnapshot`,
`filterValidSnapshots`, `buildSnapshotSignature`, `snapshotsEqual` — **121 lines with zero
`_deps` references**, calling only each other, none in `provides`, none used outside the module.
That is Pattern 2, not Pattern 1: no DI container, no manifest entry, no `registerProvides`
exposure, no re-export obligation beyond the three that were already public.

**Generalisable:** when a plan names a big function for extraction, measure its *neighbours*
before its body. The impure orchestrator is often the thing that should stay.

### Recommended non-split: undo/redo execution

`performStateBasedUndo` (197) and `performStateBasedRedo` (189) carry **10 dependencies each**
and are the execution core. With the three passes done, the file is ~1,636 lines against a
~1,500 target, and closing that last ~136 would mean cutting into those two. That is a genuinely
wide seam — the same call already accepted for routineSwitcher's search/sort/filter cluster.
Record it as a non-split rather than forcing the number.

### Still open, and why

`captureStateSnapshot`'s self-heal is worth a look before anything else moves: a synchronous
"capture a snapshot" call can trigger an async cycle switch whose errors are swallowed by
`.catch(() => {})`. The recovery is real (a stale `activeCycleIdForUndo` permanently disables
undo) but it is buried where nobody would look, and a failure is silent. Understand that path
before treating the rest of this file as a line-count exercise.


### What this plan got wrong, measured

1. **Sizing was low.** Both extractions were estimated at ~190 lines. Measured: IndexedDB
   **320**, snapshot **269**. The "~1,690 remaining" figure implied a ~2,070-line file; it was
   2,277 when that was written and 2,306 when the work started. Even both extractions would not
   have reached the ~1,500 target.

2. **The two seams were rated identically ("Medium risk"). They are not comparable.**
   Measured outbound calls: IndexedDB reaches 2 in-file functions, snapshot reaches 4 — and
   snapshot's include a call *into* the IndexedDB cluster plus two parent UI callbacks
   (`onCycleSwitched`, `updateUndoRedoButtons`). IndexedDB also **owns** its state (`undoDB`,
   `dbWriteTimers`), so moving the functions moved the state and left no shared surface.

3. **The manager back-reference pattern does not apply here.** Priority 1's lesson (price against
   `this.m` before calling a seam wide) was reached for first and is wrong for this file:
   `undoRedoManager` has **zero classes** — 33 exported functions over module-level state. There is
   no instance to hang a back-reference on. The correct precedent is `notifications.js` →
   `educationalTips.js`: a **static** import, because these functions run from synchronous paths
   (the `beforeunload` flush) with no async init to await a dynamic import from.

### Two gated constraints the original entry did not mention

- **`provides`.** `initUndoIndexedDB` and `closeUndoIndexedDB` are both in this module's `provides`
  list. Moving them without re-exporting makes `registerProvides` skip them **silently** — the
  v2.347 statsPanel failure. The parent re-exports all seven moved public functions.
- **`BOOT_CRITICAL`.** A static import from a boot-critical module makes the target boot-critical.
  `undoIndexedDB.js` had to be added to `service-worker.js`; `test:sw` is the only gate that covers it.

### Why the snapshot cluster is NOT being extracted yet

Not "too hard" — differently shaped. `captureStateSnapshot` is 120 lines that call `onCycleSwitched`
and `updateUndoRedoButtons`, i.e. it drives UI and lifecycle rather than only capturing state. That
is worth understanding before moving, and possibly worth splitting *within* the parent first. Extract
it only alongside that question, not as a line-count exercise.

### Test note

86 tests existed, but `closeUndoIndexedDB`, `renameUndoStackInIndexedDB` and `sanitizeSnapshot` had
**zero references**. Eight tests were added before the move (94 total) and **mutation-verified**: each
regression was injected and confirmed to fail the intended test. One initially did not — the
close-cancels-pending-write test passed with the cancellation deleted, because closing also nulls the
handle. Re-ordering the test to re-open *before* the timer fires isolates the real behaviour. Green is
not evidence until you have watched the test go red.

### Original assessment (retained)


### Current Responsibilities
- localStorage cache (instant boot)
- Snapshot capture, validation, sanitization
- Snapshot signature/deduplication
- State wrapping (AppState mutation interception)
- Change description (diff analysis for undo messages)
- Undo/redo execution (state restoration + UI sync)
- Keyboard shortcuts
- UI button management
- Cycle lifecycle hooks (switch, create, delete, rename)
- IndexedDB persistence (durable storage)
- Idle save scheduling
- System initialization

### Proposed Extractions (2 dynamic sub-modules)

Dynamic versioned imports — both reference module-level state and DI deps.

**`undoIndexedDB.js` (~190 lines)**
- `saveUndoStackToIndexedDB()`, `loadUndoStackFromIndexedDB()`, `deleteUndoStackFromIndexedDB()`, `renameUndoStackInIndexedDB()`, `clearAllUndoHistoryFromIndexedDB()`
- Note: NOT fully self-contained — references module-level `undoDB` (database handle), `dbWriteTimeout` (debounce timer), and calls `saveToUndoCache()` and `_deps.showNotification()`. These would need to be passed as parameters or the extracted module would need its own DI.
- Risk: Medium — cross-references to module-level variables require interface design

**`undoSnapshotManager.js` (~190 lines)**
- `validateSnapshot()`, `sanitizeSnapshot()`, `filterValidSnapshots()`, `captureStateSnapshot()`, `buildSnapshotSignature()`, `snapshotsEqual()`, `captureInitialSnapshot()`
- Snapshot operations are logically distinct from undo/redo execution
- Risk: Medium — `captureStateSnapshot` reads/writes heavily from `_deps.AppGlobalState` fields (`isInitializing`, `isSwitchingCycles`, `isResetting`, `activeCycleIdForUndo`, `lastSnapshotSignature`, `lastSnapshotTs`, `activeUndoStack`, `activeRedoStack`, `undoRedoCompletedAt`). The parent must pass these or the extracted module needs its own DI wiring.

**Remaining undoRedoManager.js (~1,690 lines)**
- Core undo/redo execution, UI updates, state wrapping, lifecycle hooks, cache, keyboard shortcuts, initialization

---

## Priority 4: recurringPanel.js

### Current State

Already has 5 dynamic sub-modules:
- `recurringPanelSummary.js` — summary text building
- `recurringPanelGrids.js` — week/month/year grid generation
- `recurringPanelForm.js` — form data binding
- `recurringPanelEvents.js` — event handlers
- `recurringPanelSetup.js` — initialization helpers

### Potential Additional Extraction

**`recurringPanelAddTask.js` (~275 lines)**
- `setupAddTaskSection()`, `populateAvailableTasks()`, `handleConfirmAddRecurring()`, `attachRecurringSummaryListeners()`
- The "add recurring task" flow is a self-contained sub-feature
- Risk: Medium — interacts with panel state and form values

**Assessment:** Low priority. The existing 5 sub-modules already demonstrate good splitting. The remaining bulk is the class skeleton, lifecycle methods, and coordination logic that naturally belongs in one place.

---

## Priority 5: taskDOM.js

### Current State

Already has 6 dynamic sub-modules:
- `taskValidation.js` (TaskValidator)
- `taskUtils.js` (TaskUtils)
- `taskRenderer.js` (TaskRenderer)
- `taskEvents.js` (TaskEvents)
- `taskButtons.js` (TaskButtons)
- `taskDOMPatch.js` (TaskDOMPatch)

### Potential Extraction

**`taskDOMCompat.js` (~450 lines — the wrapper-compatibility region at the bottom of taskDOM.js; find `initTaskDOMManager` and the delegation wrappers around it)**
- Wrapper compatibility layer: module-level functions that delegate to the `taskDOMManager` singleton
- Grouped as: validation wrappers, utility wrappers, focus restoration helpers, DOM creation wrappers
- Mostly pure delegation, but includes `initTaskDOMManager()` (~30 lines) which has initialization logic and side effects (creates the singleton instance)
- Risk: Low — wrappers are thin delegation; `initTaskDOMManager()` is the only non-trivial function and could stay in the parent

**Assessment:** Medium priority. The wrapper layer is the biggest single chunk, but it's also the simplest code in the file (just delegation). Extracting it reduces line count but doesn't reduce complexity.

---

## Deferred: migrationManager.js (`modules/routine/`)

Previously assessed as acceptable ("working code, not a problem"). Migration code is write-once infrastructure that rarely changes.

If revisited:
- **`migrationFallback.js` (~300 lines)** — fallback mode, recovery UI, `showCriticalError()`
- Risk: Medium — fallback paths are hard to test and rarely exercised

---

## Deferred: moduleLoader.js

Infrastructure code. The large `buildModuleDependencies()` function is self-contained — a single responsibility (mapping manifest declarations to actual dep values). Note: grew ~418 lines between March and July 2026 (depMappings additions, DI DOM helpers); if growth continues, revisit.

If revisited:
- **`dependencyBuilder.js`** — `buildModuleDependencies()` + helper functions (`findProviderModule`, `buildDependencyGraph`, `findCycles`)
- Risk: Medium — this is boot-critical code; any regression breaks all modules

---

## Deferred: orchestrator.js — assessed July 2026, updated Aug 2026

Five concerns in one file (see [PROJECT_STATS.md](../PROJECT_STATS.md) for its current line count):

1. **Sequence control** (its actual job) — `runBootSequence()`, `initApp()`, `startOrchestrator()`, `loadDependencies()`, `withTimeout()`
2. **Boot UI** — `updateLoaderProgress()`, `showUpdatingOverlay()`, `showBootError()`, `getErrorDetails()`, `escapeHtml()`, `ensureBootModalTemplate()`
3. **Version/SW coordination** — `gateOnServerVersion()`, `checkProductionVersionGuard()`, `waitForServiceWorker()`, `isCacheError()`
4. **Boot timing instrumentation** (June 2026 perf work) — `markBoot()`, `measureBoot()`, `clearBootTiming()`, `getBootTiming()`
5. **Data-backup cluster** (arrived after this plan was written) — `collectBackupEntries()`, `hasBackupableData()`, `downloadDataBackup()` — boot-failure recovery backup UI; a natural companion to concern 2 if the bootUI split ever happens

By responsibility count it qualifies as a god module, but it's graded a tier below routineSwitcher/statsPanel: it's phase-0 code that runs before the DI framework and module loader exist, so it *cannot* delegate the way ordinary modules do — some accretion is inherent. `CLAUDE.md` already documents it as "sequence control + boot UI + early boot coordination" (documented intent, not drift).

If revisited, the split is unusually low-risk precisely because it's pre-DI — no manifests, no DI pipeline, no facade pattern:
- **`boot/bootUI.js`** — loader progress, updating overlay, error screen (concern 2)
- **`boot/bootTiming.js`** — mark/measure instrumentation (concern 4)
- Both are plain static imports from sibling files (follow existing boot-file import conventions re: cache-busting)
- Remaining orchestrator.js: ~500–600 lines of pure sequence + version-gating logic

**Trigger:** not worth a dedicated refactor session; do it opportunistically next time the boot timing code is touched (e.g., continuing the load-perf investigation).

---

## Recommended Execution Order

1. ~~**routineSwitcher theme picker**~~ — ✅ SHIPPED v2.484
2. ~~**`update-version.sh` CSP-hash regeneration → its own script**~~ — ✅ SHIPPED v2.488
   (`csp_hash_sync.py` + 17 tests). The blast-radius argument held: the extraction surfaced a
   path-resolution bug that no release would ever have revealed.
3. ~~**routineSwitcher preview**~~ — ✅ SHIPPED v2.484
4. ~~**routineSwitcher search/sort/filter**~~ — ✅ SHIPPED v2.484, but only the three PURE
   transforms; the state-owning half is a recorded non-split (see Priority 1)
5. ~~**undoIndexedDB**~~ — ✅ SHIPPED v2.495. Sized at ~190 lines and "needs an interface"; measured
   320 lines and needed three injected deps, because it OWNS its state (`undoDB`, `dbWriteTimers`)
   and the state moved with it.
6. **taskDOMCompat** — large extraction, mostly pure delegation
7. ~~**undoSnapshotManager**~~ — ✅ SHIPPED v2.496 + v2.498, but **NOT as scheduled**. This entry named
   `captureStateSnapshot`, which measured as the least extractable function in the file. What came out
   instead was its pure NEIGHBOURS: `undoSnapshotUtils.js` (121) and `undoTransactionDiff.js` (276),
   both Pattern 2, zero DI. Measure a function's neighbours before its body.
8. **recurringPanelAddTask** — trigger-based, low priority
9. ~~**EducationalTipManager** out of `notifications.js`~~ — ✅ **SHIPPED v2.463** (Priority 6)
10. **onboardingManager interactive demo** — Priority 8, the widest-value/narrowest-seam extraction
    currently on this page: 470 lines, one dependency, one outbound call. First-run splash second.
11. **Remaining `update-version.sh` stages** — `restore.sh` generation next; the `?v=` sweep was
    RE-SCOPED and demoted Aug 23 2026 (content hashing superseded most of it — see Scripts above),
    both trigger-based (Priority 7)
12. **guidedTourManager prompt dedup** — Priority 9, move 1: one generic `_showTourPrompt(tourId)`
    behind twelve unchanged public wrappers. Narrowest seam currently on this page — no new file, no
    new `provides`, no wiring layer touched. Move 2 (tour definitions → data module) second, and only
    if the `onEnter` predicates go declarative cleanly; otherwise record it as a non-split.

Sizes are deliberately not given here — see "When this plan is DONE" and measure fresh.

✅ Done (removed from the order): **statsPanel gestures + rewards** — shipped as `statsPanelGestures.js` + `statsPanelRewards.js` (commit `806f8082`; see Priority 2).

Opportunistic (no scheduled slot): **orchestrator bootUI/bootTiming split** — next time boot timing code is touched.

Not an extraction, but recorded so it is not mistaken for one: **`settingsUIManager`'s 23 repeated
`setupXToggle()` functions want a declarative toggle table**, not a split. See the August 21 2026
assessment above. `guidedTourManager` (Priority 9) is the same remedy and is scheduled — shipping it
first would give that pattern a worked precedent to copy.

Each extraction should be done as a separate commit with full test verification before proceeding to the next.

---

## Execution Checklist (Per Extraction)

### Build

1. Create the new sub-module file in the same directory as the parent
2. Move functions/methods to the new file, exporting them
3. Add dynamic versioned import in the parent's `init()` or constructor
4. Store references and update delegation calls in the parent
5. Do NOT add a manifest entry — sub-modules are internal
6. **Re-verify the parent's `provides` against what the facade actually supplies.** Step 5 says
   don't ADD entries; it does not say the existing list is correct. See "What This Does NOT
   Change" below — the shipped statsPanel split left three fictional entries in place.
6b. **Check the docblock at every block boundary.** A range-based move (from the start of a
    method to the start of the next) sweeps the NEXT method's JSDoc into the sub-module, leaving
    an orphan comment there and an undocumented method behind. The Priority 8 demo extraction did
    this **three times in one move** — `completeOnboarding`, `_buildFocusViewWithCta` and
    `_scheduleFirstRunWelcomeAdvance` all lost their docs. It is silent: both files still parse,
    lint is clean, and `validate:comments` passes because the identifiers still exist. Scan the
    sub-module for a docblock not immediately followed by a method definition.

7. **Give the sub-module its own test file** (`tests/<subModule>.tests.js`), importing it
   directly with `?v=${cacheBuster}` rather than through the facade — the facade's `init()`
   may create a singleton (see CLAUDE.md § Testing note). This is already the norm:
   `statsPanelGestures`, `statsPanelRewards`, `collapsibleSections` and `recurringPanelSetup`
   each have one. `educationalTips` (v2.463) does not — the gap this step closes.

### Verify — the gates, not just the suite

The two defects the completed splits shipped were both invisible to `lint` + `npm test`. Run:

8. `npm run lint` — 0 errors, warnings under the ratchet
9. `npm test` — no regressions
10. **`npm run test:sw` — MANDATORY for any new file.** A static import from anything already
    boot-critical makes the new file boot-critical too; left out of `BOOT_CRITICAL`, offline boot
    goes to the network for it. No `validate:*` gate and no other suite covers this.
11. **`npm run validate:provides`** — catches the manifest over-claim described in step 6
12. `npm run validate:di` — the sub-module's deps must still resolve (facade sub-files are
    scanned via `FACADE_SUB_FILES`)
13. **`npm run validate:comments`** — a move invalidates every comment that names a moved
    identifier by its old home; gated at 0
14. `npm run test:journey` — for anything user-facing
15. Manual smoke test of the affected feature
16. Commit with descriptive message

**Both of these have already happened during this plan's execution, so treat 10 and 11 as the
load-bearing steps rather than box-ticking:**

- `f7a207f7` — `collapsibleSections.js` was left out of `BOOT_CRITICAL` and caught only by
  `test:sw`. The commit records that the full suite, journey, a11y and meta were all run; the one
  gate that catches new module files was not.
- `14a9bc6f` — the **completed** Priority 2 statsPanel split (v2.347) left three fictional entries
  in `provides`. Undiscovered for ~115 versions, and it took a new gate (`validate:provides`) to
  find them.

---

## What This Does NOT Change

- No manifest entries added or removed
- No DI wiring changes
- No boot sequence changes
- No new dependencies introduced

### Corrected Aug 21 2026: `provides` is re-verified, not assumed unchanged

This list used to promise "no public API changes (parent's `provides` list stays the same)."
That is wrong in the one case that matters, and the completed Priority 2 split is the
counter-example: statsPanel's `provides` listed `openHistoryModal`, `openClearedTasksModal` and
`openAchievementsModal`, which the facade never supplied — the DI names belong to
historyManager / clearedTasksManager / achievementsManager. Preserving the list unchanged
preserved the fiction (`14a9bc6f`, v2.462).

The correct rule: **an extraction must not ADD or REMOVE entries to change the public API, but it
must re-verify that every entry still names something this module actually supplies.** A split is
exactly when someone reads that list closely, which makes it the right moment to check it.
`validate:provides` now gates this.
