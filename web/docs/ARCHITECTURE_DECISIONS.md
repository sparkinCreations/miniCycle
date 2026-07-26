# Architecture Decision Records (ADRs)

This file records the **reasoning** behind significant architecture decisions in
miniCycle — the "why," which normally lives only in a maintainer's head. Its
companion, `HOW_MINICYCLE_WORKS.md`, explains *how* the system works; this explains
*why it's built that way*.

## How to use this file

- Each entry is one decision. When you make a new significant call, add a new ADR at
  the bottom — don't edit old ones.
- If a later decision reverses an earlier one, add a **new** ADR that says
  "Supersedes ADR-00X" and mark the old one as **Superseded**. The history is the
  point; don't delete it.
- Keep them short. The value is the *why* and the *alternatives rejected*, not prose.

**Status legend:** `Accepted` (in force) · `Superseded` (replaced by a later ADR) ·
`Proposed` (under consideration).

> Note on dates: these ADRs were written retroactively, and the dates below are
> **anchored to `CHANGELOG.md`** — each entry notes the version/date of the changelog
> line that best marks when the decision was in force. Several foundational
> decisions (no-framework, DI, AppState, three-phase boot) were already live when the
> changelog begins (v1.599, 2025-12-29), so they're dated **"in place by 2025-12-29
> (predates changelog)"** rather than given a false precise date. For anything you
> add from here on, use the real date of the decision.

---

## ADR-001 — No framework, no build step

**Status:** Accepted, amended by ADR-010 (dev remains no-build; releases are now bundled) · **Date:** in place by 2025-12-29 (predates changelog — app was already framework-free/no-build at v1.599)

**Decision.** Build the app in vanilla JavaScript on native ES modules, with no
frontend framework (React/Vue/etc.) and no required bundler for development. The app
runs directly from source in the browser. `esbuild` is used only to produce
distributable store builds.

**Why.**
- The app is a self-contained, offline, local-first PWA — it has no server and a
  bounded feature set, so a framework's machinery is cost without much benefit.
- "Runs straight from source" means the dev loop is: edit a file, refresh. No build,
  no webpack config, no install step to see a change. This is spelled out as a
  selling point in the getting-started docs.
- Fewer dependencies = less supply-chain risk, less version churn, and nothing that
  can go end-of-life and force a migration.

**Rejected alternatives.**
- *React/Vue:* would bring a component model and ecosystem, but also a build
  pipeline, a large dependency tree, and a framework-shaped rewrite of the whole
  app. Not worth it for this scope.
- *A bundler-based dev workflow:* rejected to keep the "refresh and it works" loop.

**Consequences.**
- (+) Extremely simple dev setup; total control; minimal dependencies.
- (−) The app builds its *own* versions of things a framework would provide — a DI
  container (ADR-002), a state store (ADR-003), a boot orchestrator (ADR-005). Those
  are bespoke, so a newcomer learns them here rather than bringing framework
  knowledge. (Mitigated by thorough docs.)

---

## ADR-002 — Hand-built dependency injection instead of direct imports

**Status:** Accepted · **Date:** in place by 2025-12-29 (predates changelog); DI hardening tracked through v2.098 (2026-03-15) and v2.274 (2026-07-01)

**Decision.** Modules do not import their collaborators directly. Each module
*declares* what it needs (in `moduleManifests.js` and via `createDIModule` in
`diBase.js`), and the boot system *delivers* those dependencies into a shared
container. Inside a module, `_deps.X` is "the X that was injected into me."

**Why.**
- **Testability** is the headline reason. Because a module receives its
  dependencies, a test can pass *fakes* (a mock AppState, a no-op notifier) and
  exercise the module in isolation. A module that reached out and grabbed the real
  AppState could not be tested this way.
- **Decoupling.** Modules talk *through* the container, not directly to each other,
  so one can be reworked or replaced without a chain reaction — as long as it still
  `provides` what others `require`.
- **Declarative wiring.** ~130 modules with hand-written wiring would be
  unmaintainable; declaring needs and letting the system compute order scales.

**Rejected alternatives.**
- *Direct `import` between modules:* simplest to write, but creates a tangled
  dependency web and makes isolated testing nearly impossible.
- *A third-party DI/IoC library:* would add a dependency (against ADR-001) for
  something a small purpose-built container covers.

**Consequences.**
- (+) Isolated, mockable modules; the test suite depends on this.
- (+) Adding a module is "declare its needs," not "manually rewire boot."
- (−) A bespoke pattern to learn; the wiring path is four layers
  (`provides` → loader mapping → consumer manifest → `createDIModule`), and missing
  a layer makes a dep silently `undefined`.

---

## ADR-003 — Single source of truth: all state changes go through `AppState.update()`

**Status:** Accepted · **Date:** in place by 2025-12-29 (predates changelog); AppState teardown/retry hardening at v1.671 (2026-01-04) onward

**Decision.** All app data lives in one `AppState` record. Reads go through
`AppState.get()`. **Every** change goes through `AppState.update(fn)` — never by
mutating the data object directly. `update()` transactionally: snapshots the prior
state, applies the change, schedules a save, and notifies subscribers.

**Why.** This one chokepoint is what makes three features *possible at all*:
- **Reliable undo** — because there's exactly one place every change passes through,
  the undo system can snapshot every change. Scattered mutation could not support
  trustworthy undo.
- **Automatic persistence** — `update()` schedules the save, so no caller has to
  remember to save.
- **Automatic UI refresh** — `update()` notifies subscribers ("rings the bell"), so
  the screen redraws itself in response to data changes. Callers never manually
  refresh the UI.

Direct mutation bypasses *all three* (undo, save, redraw), which is why the
contributor docs make "always use `AppState.update()`" a top-tier rule.

**Rejected alternatives.**
- *Let modules mutate state directly:* simpler per-call, but loses undo, save, and
  auto-refresh, and reintroduces the "scattered sticky notes" inconsistency problem.
- *A third-party store (Redux, etc.):* against ADR-001; the bespoke store is small
  and fits the app's needs.

**Consequences.**
- (+) Undo, persistence, and reactive UI all fall out of one rule.
- (−) The rule must be enforced by discipline/review; a single direct mutation
  silently skips the machinery. (This is exactly the failure mode behind the undo
  rollback-UI bug: the *failure* path restored state but skipped the notify step.)

---

## ADR-004 — Client-side schema versioning and migration (name-key + stable `id`)

**Status:** Accepted · **Date:** Schema 2.5 documented v2.263 (2026-06-28); migration system predates changelog

**Decision.** Stamp every saved data blob with a `schemaVersion` (currently `"2.5"`).
On startup, `migrationManager` reads the stamp and upgrades older data to the current
shape, **backing up the old data before rewriting.** Cycles remain keyed by their
**display name** (the historical primary key), while a stable `id` field
(`cycle-...`) is carried alongside for forward use.

**Why.**
- The app has **no server**, so users hold data in whatever shape was current when
  they saved it. Without versioned migration, any change to the data shape would
  either break existing users or freeze the schema forever.
- Migration ran `newData.data.cycles = oldCycles` — i.e. it *carries the existing
  name-keyed map through unchanged* — because rewriting keys during migration on
  millions of unknown local states is risky and not rollback-able. Backing up first
  makes even a failed migration recoverable.
- The stable `id` was introduced *alongside* the name-key (not as a replacement) so
  the app could start moving toward ID-based identity **without** a breaking
  rewrite of everyone's local data.

**Rejected alternatives.**
- *No versioning:* would trap the data shape permanently or break users on update.
- *Immediately re-key cycles by `id` during a migration:* riskier (no safe rollback
  for local storage across unknown states); deferred in favor of the additive `id`.

**Consequences.**
- (+) The data shape can evolve safely over time; existing users survive updates.
- (−) The name-key + `id` duality means some routine code must "compensate for
  both": rename becomes a create-copy-delete-repoint of the key, two routines can't
  share a display name, and some "pick next cycle" fallbacks rely on key order. A
  future ADR could propose making `id` the real key and demoting `name` to a plain
  display field (which would retroactively simplify rename/delete).

---

## ADR-005 — Three-phase boot with retry, cleanup, and lite fallback

**Status:** Accepted · **Date:** three-phase boot predates changelog; retry/teardown + generation guard shipped v2.284 (2026-07-08)

**Decision.** Boot in three ordered phases via `orchestrator.js`:
Phase 1 Core (AppState, migration, utils), Phase 2 Features, Phase 3 UI. Enforce
order with `await`. Wrap the sequence in failure handling: on a failed attempt,
tear down the partial ("zombie") attempt and **retry**; if it still fails, fall back
to the lite version.

Timeouts (from `constants.js`): Phase 1 = 15s, Phase 2 = 30s (largest phase, 40+
modules), Phase 3 = 15s, pre-boot version gate = 1.5s. In the HTML shell, an
**8-second** late fallback and a **60-second** hard load-timeout both redirect to
lite as last resorts.

**Why.**
- Some subsystems depend on others existing first (nothing works before AppState);
  strict phase ordering encodes those dependencies.
- Boot on real devices *does* fail — flaky networks, stale caches, iOS killing the
  service worker in a backgrounded PWA. Rather than show a white screen, the app
  retries, and as a last resort serves the simpler lite build so the user gets
  *something*.
- Cleaning up the partial attempt before retry prevents two half-alive app instances
  from racing writes into the shared deps container (documented as the "zombie
  attempt" guard).

**Rejected alternatives.**
- *Boot everything at once / no phases:* would try to use subsystems before they
  exist.
- *No retry, no fallback:* simplest, but any transient failure becomes a broken app
  for the user.

**Consequences.**
- (+) Resilient startup; graceful degradation instead of white screens.
- (−) ~80% of the boot file is failure-handling around a simple 3-step core, which
  makes the file look far more complex than the core logic is. The specific timeout
  numbers are tuned values — treat them as tunable, not magical.

---

## ADR-006 — `required()` deps are not enforced by default (graceful degradation over fail-fast)

**Status:** Accepted · **Date:** DI enforcement rollout began v2.098 (2026-03-15); strict-mode ENFORCE work v2.274 (2026-07-01) · **Revisit-worthy**

**Decision.** The DI container supports a `strict` mode that *throws* when a
`required()` dependency is missing, but strict mode is **off by default** and turned
on in only 2 modules. Everywhere else, a missing required dep logs a `console.warn`
and resolves to `null` rather than throwing. In practice most modules declare deps
as `optional(null)` (roughly 781 `optional()` vs 92 `required()` across the code).

**Why.**
- The app's guiding instinct is **degrade gracefully, don't crash the user.** A
  missing non-critical dependency should let the rest of the app keep working, not
  hard-fail boot. This matches the retry/fallback philosophy in ADR-005 and the
  data-salvage-over-reset philosophy in the storage layer.
- Modules are written to guard optional deps anyway (`if (_deps.x) { ... }`), so a
  `null` is expected to be survivable.

**Rejected alternatives.**
- *Strict mode everywhere (fail-fast):* would catch wiring mistakes loudly and
  early, but risks a single missing dep taking down boot — the opposite of the
  graceful-degradation goal.

**Consequences.**
- (+) One broken/missing dependency rarely bricks the whole app.
- (−) `required()` is effectively documentation, not enforcement — a wiring mistake
  surfaces later as a downstream "cannot read property of null" plus a warning,
  rather than a clear failure at the wiring point. **Worth revisiting** for the most
  safety-critical modules (state, storage, migration), where fail-fast might be
  preferable to silent degradation.

---

## ADR-007 — System-driven state changes bypass undo history

**Status:** Accepted · **Date:** in place by early 2026 (recurring watcher predates most of the changelog)

**Decision.** Changes made by the app *itself* — not by the user — are committed
through a separate path (`commitSystemUpdate` in the recurring watcher) that updates
state **without** recording an undo entry. User-initiated changes go through the
normal `AppState.update()` path and *are* undoable.

**Why.**
- The recurring watcher spawns fresh task copies in the background on a schedule,
  even while the user isn't interacting. If those spawns entered undo history, the
  user could hit Undo and remove a task the app created on its own while they were
  away — confusing and wrong.
- The clean conceptual rule: **user actions belong in undo; system actions don't.**

**Rejected alternatives.**
- *Route watcher spawns through normal `update()`:* simplest, but pollutes undo with
  background events the user never performed.

**Consequences.**
- (+) Undo reflects only what the user actually did.
- (−) There are now two write paths (user vs. system). Anyone adding a background/
  automated mutation must consciously choose the system path — a subtlety worth
  knowing about.

---

## ADR-008 — Adaptive recurring-watcher interval (active vs. idle)

**Status:** Accepted · **Date:** in place by early 2026 (recurring watcher predates most of the changelog)

**Decision.** The recurring watcher runs on a timer whose rate depends on whether any
recurring templates exist: **~15 seconds** when templates are present (active),
slowing to **~2 hours** when there are none (idle). Values live in `constants.js`
(`RECURRING_WATCHER` / `RECURRING_WATCHER_IDLE`).

**Why.**
- When the user has recurring tasks, checks must be frequent enough that a scheduled
  task appears promptly.
- When they have none, frequent checks are pure waste — battery and CPU spent
  finding nothing. Slowing to 2h avoids that cost with no downside (a newly created
  template restarts the watcher at the active rate).

**Rejected alternatives.**
- *One fixed interval:* either too slow when active or wasteful when idle. The
  adaptive approach gets both.

**Consequences.**
- (+) Responsive when it matters, battery-friendly when it doesn't.
- (−) Two intervals and a switch condition to reason about; the switch must be
  triggered whenever templates are added/removed.

---

## ADR-009 — Browser-based (Playwright) testing over unit mocking

**Status:** Accepted · **Date:** Playwright runners added v1.635 (2026-01-02)

**Decision.** Test primarily against a real browser (Playwright + an in-browser test
suite), rather than a Node-based unit runner with heavy mocking of browser APIs.
A prior Jest-based approach was dropped.

**Why.**
- Nearly every module touches real browser surfaces — the DOM, `localStorage`,
  `IndexedDB`, timers, service worker. Mocking all of those faithfully is
  error-prone; testing against an actual browser exercises the real behavior.
- The DI design (ADR-002) already makes modules injectable, so tests can still pass
  fake collaborators where needed *within* the real-browser context.

**Rejected alternatives.**
- *Jest with mocked browser APIs:* fast and isolated, but the mocks drift from real
  browser behavior, and the app's heavy reliance on real browser APIs made the mocks
  a maintenance and fidelity problem.

**Consequences.**
- (+) Tests reflect real browser behavior; high confidence for a browser-only app.
- (−) Some failure-only paths are hard to trigger from a browser test (e.g. forcing
  `AppState.update` to throw to exercise a rollback branch), so the most
  safety-critical error paths can be under-covered. Worth targeted tests that inject
  a throwing dependency for those branches specifically.

---

## ADR-010 — Deploy-time bundling for web releases (amends ADR-001)

**Status:** Accepted · **Date:** 2026-07-14 (v2.294 — first bundled production deploy)

**Decision.** Keep development no-build (ADR-001 unchanged there), but bundle **releases**:
Netlify runs `scripts/build-web.cjs` (esbuild) on every deploy and publishes `web/dist/` —
~107 stable-path entries + content-hashed shared chunks, minified (3.4MB JS → 1.43MB), with
the service-worker precache list generated from the build output instead of hand-maintained.
Ship rule: app-code changes reach users only via `update-version.sh` (a bare push to `main`
deploys but leaves existing users' service workers on the old build).

**Why.**
- Measured cold-load cost (July 2026, r/website feedback + own baselines): the unbundled deploy
  shipped 3.4MB of unminified JS across 100+ files. Bundling cut production cold-boot
  interactive ~2.7× on capable hardware (1.2–1.5s → ~490ms).
- Parse cost dominated slow-device boot (features window = 75–82% of boot on the old-Android
  baseline); minification attacks it directly.
- The generated precache list ends the hand-list drift class ("module missing from precache →
  offline boot dies").
- Prerequisite for content-hashed file identity (see `INCIDENT_service-worker-stale-cache.md`),
  which eliminates the `?v=` mixed-graph bug class rather than managing it.

**Rejected alternatives.**
- *Per-file minification without bundling* (the June 2026 `MINIFICATION_PLAN.md`): keeps every
  network round trip and the precache double-fetch; superseded before implementation.
- *Bundling the dev workflow too:* rejected — "edit, refresh" stays (ADR-001's core value).
- *Adopting Workbox for the SW:* rejected — the custom SW's iOS-specific machinery (circuit
  breaker, synthetic version.js) would need reimplementing; only the *generated-manifest idea*
  was adopted.

**Consequences.**
- (+) ~2.7× faster cold boot for the fast cohort; 58% less JS to parse everywhere; precache
  list can't drift; foundation laid for content-hashed identity.
- (−) A build step now exists between source and production (dev unaffected). Deploy ≠ release:
  the `update-version.sh` discipline is now mandatory, not just conventional.
- (−) esbuild-specific invariants must be preserved (runtime-import rewriter; fold-proof
  wrappers) — documented in `deployment/BUILD_PROCESS.md` "Gotchas."

---

## ADR-011 — Concurrent-modification conflict: last-write-wins + notify (supersedes the never-shipped merge intent)

**Status:** Accepted · **Date:** 2026-07-26 (v2.330)

**Decision.** When `save()` detects that another context persisted newer data while this
context still holds unsaved changes (stored `lastModified` newer by more than
`DEBOUNCE.CONCURRENT_MOD_CONFLICT`), **adopt the stored data (last-write-wins)** and then
**warn the user + notify subscribers** — rather than merging the two states. This supersedes
the unimplemented `mergeStates()` branch sketched in the 2025 AppState spec
(`archive/CODE_REVIEW_FINDINGS_2025.md`).

**Why.**
- The 2025 spec sketched a merge (`this.data = this.mergeStates(current, this.data)`), but
  `mergeStates()` was never implemented (`grep mergeStates modules/` → 0). What shipped was a
  discard placeholder that *also* skipped `notifyListeners()` — so the conflict path both lost
  the losing context's edits **and** left the UI rendering ghosts of them until an unrelated
  redraw dropped them. That silent-swap-under-a-stale-UI is the same failure shape as the undo
  rollback-UI bug and the exact hazard ADR-003's notify guarantee exists to prevent.
- The real harm was the *silent + UI-lying* part, not the choice of resolution strategy. v2.330
  restores the ADR-003 guarantee on this path: warn the user their in-flight changes were
  superseded, and notify subscribers so the UI redraws against the adopted state (mirroring the
  storage-event handler that already handled the same situation correctly).
- Correctly merging two divergent full-state trees (task order, completion, recurring templates,
  per-cycle settings) is genuinely hard; a wrong merge corrupts silently. For a single-user app
  where same-routine concurrent editing across contexts is rare, predictable last-write-wins is
  the safer default than a bespoke merge.

**Rejected alternatives.**
- *Implement `mergeStates()` as the 2025 spec intended:* preserves both contexts' edits, but
  safe merging of divergent trees is a large, high-risk effort. Deferred, not dropped — tracked
  in `future-work/APPSTATE_MERGE_STATES.md`; revisit if multi-context concurrent editing becomes
  common or users report lost edits.
- *Keep the silent discard:* loses data **and** lies to the UI. That was the bug fixed here.

**Consequences.**
- (+) The UI can no longer render ghost edits after a conflict; the user is told when their
  unsaved changes were superseded. Restores ADR-003's notify guarantee on the last path missing it.
- (−) The losing context's unsaved edits are still discarded — this is *announced* data loss, not
  *prevented* data loss. Accepted for single-user usage; the merge upgrade is the escape hatch.
- Does **not** supersede ADR-003 (its guarantee stands and is now honored here); supersedes only
  the unimplemented 2025 merge sketch.

---

## Template for new ADRs

```markdown
## ADR-0NN — <short decision title>

**Status:** Accepted · **Date:** YYYY-MM-DD

**Decision.** <what you decided, in 1–3 sentences>

**Why.** <the reasoning — the part that's usually lost>
- <driver 1>
- <driver 2>

**Rejected alternatives.**
- *<alternative>:* <why not>

**Consequences.**
- (+) <benefit>
- (−) <cost or risk you're accepting>
```
