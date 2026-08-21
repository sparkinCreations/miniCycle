# Single-Source Consolidation Plan

**Date:** August 21, 2026
**Status:** Proposed — inventory measured, nothing built
**Related:** [AUTO_GENERATED_DEPMAPPINGS_PLAN.md](AUTO_GENERATED_DEPMAPPINGS_PLAN.md) (the deepest existing treatment of one entry below), [VALIDATION_GATES.md](../working-on-code/VALIDATION_GATES.md), [LARGE_MODULE_SPLITS_PLAN.md](LARGE_MODULE_SPLITS_PLAN.md)

---

## Problem

The codebase has **22 npm gates and 17 CI steps**, and a striking number of them exist for
the same underlying reason: *N hand-maintained lists must agree, and nothing made them
agree.* A gate makes the disagreement **detectable**. It does not reduce N.

That distinction is the whole point of this page. Every gate we have added is individually
justified — each one was written after a real bug, most of them silent ones. But the gate
count is now itself a surface a contributor has to hold, and each new gate is another list
of its own. Adding gate #23 to watch a fourth copy of something is a worse trade than
deleting the fourth copy.

This plan inventories the divergent lists, sorts them by whether the duplication is
**mechanical** (derivable, therefore removable) or **intentional** (a narrowing of human
intent, therefore permanently hand-written and correctly gated), and proposes an order.

---

## The principle

> **A gate that computes the correct answer in order to compare against it is proof that
> the list is derivable. Where that is true, the same code can emit the list instead of
> checking it — and the gate becomes the generator.**

This is not speculative. `test:sw`'s precache drift guard already does the hard half:

```javascript
// assertPrecacheCoversModules() — walks the filesystem for the real answer
(function walk(dir) { /* ... collects every .js under modules/, minus /archive */ })('modules');
return all.filter(f => !precached.has(f) && !PRECACHE_EXEMPT.some(re => re.test(f)));

// assertPrecacheCoversCss() — parses main.css for the real answer
const imported = (css.match(/@import\s+url\(['"]\.\/[^'")?]+\.css/g) || []) ...
```

It computes the correct `BOOT_CRITICAL` and `CSS_FILES`, compares them to the hand-written
arrays in `service-worker.js`, and then **throws the computed answer away** and asks a human
to retype it. The information required to generate the list is already in the guard.

**And the pattern already ships successfully elsewhere.** CSP hashes are computed once by
`update-version.sh` and written into **three** deployment configs (`netlify.toml`,
`.htaccess`, `nginx-security.conf` — 22 hashes each), with `validate:csp` verifying the
result. Nobody hand-maintains 66 hashes. That is exactly the compute → write → verify shape
this plan proposes to extend, and it is the reason CSP drift is not on the list below.

### The counter-principle — when NOT to consolidate

A list must stay hand-written when it is a **narrowing of intent**, not a copy of a
derivable fact. Deriving it would mean inventing intent the author never expressed.

The clearest example is manifest `provides`. You cannot generate it from the module's
surface, because "every method this class happens to have" is not the contract — `provides`
is deliberately narrower than the class. `validate:provides` is therefore correctly a
*checker* and should never become a generator. Same for `requires` / `optionalDeps`: the
declaration is what gives `ENFORCE_REQUIRES` its meaning.

Applying the wrong half of this principle is the failure mode to avoid. The test is:

> Could a script determine the right answer **without** asking the author what they meant?
> If yes, generate it. If no, declare it and gate it.

---

## Inventory

Measured Aug 21 2026. "Places" counts locations that must be edited together.

| # | Divergent list | Places | Current gate | Derivable? | Priority |
|---|---|---|---|---|---|
| 1 | Test-module registration | **7** (6 in `module-test-suite.html` + `run-browser-tests.cjs`) | none | **Fully** | **P1** |
| 2 | `BOOT_CRITICAL` + `CSS_FILES` precache | 2 arrays vs the real boot graph | `test:sw` | **Fully** (the guard already computes it) | **P2** |
| 3 | Quick Actions triple | 3 (`ACTION_REGISTRY`, `VALID_ACTION_IDS`, `ACTION_BUTTON_MAP`) | `validate:api` | **Mostly** | **P3** |
| 4 | featureBoot `*ApiObj` allow-lists | 9 literals, ~75 names | `validate:api` | **Partly** | **P4** |
| 5 | `depMappings` ← manifests | 258 entries vs 191 `provides` names | `validate:di` | Partly | Deferred — see [existing plan](AUTO_GENERATED_DEPMAPPINGS_PLAN.md) |
| 6 | CSP hashes × 3 configs | 3 × 22 | `validate:csp` | — | ✅ **Already generated** — the model |
| 7 | Manifest `provides` / `requires` | 1 each | `validate:provides`, `validate:di` | **No — intentional** | ❌ Never consolidate |

---

## P1 — Test-module registration (7 places → 1)

**Best ratio on the page, and zero risk to shipped code.** Adding one test module today means
editing seven locations, six of them inside `tests/module-test-suite.html`:

1. an `<option>` in the module picker
2. a dynamic `import()` of the `.tests.js` file
3. membership in a **45-name inline array literal** used for load-strategy branching
4. an entry in the import-path map
5. an `else if (currentModule === ...)` dispatch arm
6. an entry in the "run all" descriptor list
7. plus `ALL_MODULES` in `tests/automated/run-browser-tests.cjs`

Nothing gates this. A module missing from #7 simply never runs in CI — it passes locally,
and its absence looks identical to success.

**Approach.** One `tests/testModules.js` exporting a descriptor array — `{ key, label,
importPath, runFn, loadStrategy }` — imported by both the HTML harness and the Node runner.
Six of the seven sites collapse into iteration over that array.

**Watch out:** if the harness reads the list from an *inline* `<script>`, that changes the
file's CSP hash. Keep it an external module import so `validate:csp` is unaffected.

---

## P2 — Precache lists (generate what the guard already computes)

`service-worker.js` hand-maintains `BOOT_CRITICAL` (135 entries) and `CSS_FILES`. The
`test:sw` guard derives the correct contents from the filesystem and from `main.css`'s
`@import`s, then reports the diff for a human to apply.

This is the failure mode CLAUDE.md singles out as invisible to `npm test` and every
`validate:*` — `styleValidators.js` shipped green through all of them and failed CI here in
Aug 2026.

**Approach.** Promote the guard's computation into a generator (`scripts/generate-precache.js`)
that rewrites the two arrays in place; keep `test:sw` verifying the committed result, so
generation and verification stay independent. `update-version.sh` already rewrites shipped
files during a release, so there is a natural home for the step.

**Constraints.** `service-worker.js` is ES5-only and must stay standalone-parseable —
emitting a literal array is fine, importing a manifest is not. The 3 `PRECACHE_EXEMPT`
patterns encode genuine intent (lazy/dev-only) and stay hand-written; they are the
"narrowing" half and belong with the generator's input, not its output.

---

## P3 — Quick Actions triple

`ACTION_REGISTRY` lives in `modules/ui/quickActionsManager.js`; `VALID_ACTION_IDS` and
`ACTION_BUTTON_MAP` live in `modules/ui/actionUsage.js`. All three describe the same set of
actions from different angles, and `validate:api` exists to keep them agreeing — a miss
means an action silently never counts.

**Approach.** Give `ACTION_REGISTRY` the button id it currently omits, then derive both
others from it (`VALID_ACTION_IDS` = its keys; `ACTION_BUTTON_MAP` = key → button id).
Small, contained, and it retires one of the two things `validate:api` watches.

**Check first:** confirm the split is not deliberate module-boundary hygiene —
`actionUsage.js` was extracted from `quickActionsManager.js` on purpose, and the dependency
direction matters. If importing the registry would invert that edge, move the registry into
`actionUsage.js` rather than adding a back-import.

---

## P4 — featureBoot `*ApiObj` allow-lists

Nine literals holding roughly 75 names. CLAUDE.md is blunt about the failure mode: a method
the manifest genuinely delivers on `deps.<category>` is *still dropped* unless it is named
here, the optional chain swallows it, and nothing warns — "this silently broke 3 features in
one session."

That phrasing matters for this plan: it describes the narrowing as an **accident of
maintenance**, not a deliberate policy. If that holds, the allow-lists are derivable from
the manifests (`provides` filtered by `api` category) and the hand-written copy can go.

**Approach.** Build the derived object beside the hand-written one and diff them at boot in
dev. Every name present in one and not the other is either a bug or a deliberate exclusion —
enumerate them before deleting anything. This is the riskiest item here and the one most
likely to end in "keep it, but generate the common case."

**Do this last.** It touches live runtime wiring, and unlike P1/P2 a mistake is a silently
missing feature rather than a failing build.

---

## Ordering

Ascending blast radius, one PR each — the same discipline as the splits plan:

| Order | Item | Blast radius | Why here |
|---|---|---|---|
| 1 | P1 test registration | Dev tooling only | Nothing shipped can break; 7→1 is the best ratio available |
| 2 | P3 Quick Actions triple | One feature | Small and contained; retires half of `validate:api` |
| 3 | P2 precache generation | Shipped, but mechanical | Fixes the failure mode no other gate can see |
| 4 | P4 `*ApiObj` | Runtime wiring | Highest risk, silent failure mode; go last, with a diff phase |

`depMappings` (#5) stays deferred on its existing plan's own criteria. Worth noting for that
page: it cited **~230 entries at v2.412** and set "crosses ~500" as a trigger — the count is
**258 as of v2.462**, so it is drifting upward but nowhere near the threshold.

---

## How to tell a real win from a false one

A consolidation succeeded only if **the number of places a human must edit went down**. Two
ways to get this wrong:

- **Moving duplication rather than removing it.** If the new "single source" is itself
  hand-maintained *and* the old lists remain as overrides, N did not drop. This is the same
  trap recorded against `settingsUIManager` in the splits plan: 23 near-identical functions
  split across two files is still 23 functions.
- **Deriving intent.** If the generator has to guess what the author meant, the output will
  be confidently wrong in a way the old hand-written list never was. Generate facts; declare
  intent.

Keep the gate after consolidating. A generator and its verifier catching each other is the
CSP arrangement, and it is why nobody has hand-edited a hash in months.
