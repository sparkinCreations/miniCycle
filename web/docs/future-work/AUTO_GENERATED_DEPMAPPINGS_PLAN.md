# Auto-Generated depMappings Plan

**Date:** April 27, 2026
**Status:** Deferred — mitigated by `npm run validate:di` (see below); revisit only if depMappings maintenance cost grows
**Related:** [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md), [feedback_di_consumer_surface.md](../../../../.claude/projects/-Users-mjaynumberone-Documents-Programs-Code-miniCycle/memory/feedback_di_consumer_surface.md) (memory)

---

## ✅ August 2026 — Urgency removed by `validate:di`

**Nothing from this plan was ever built** — no `buildAutoDepMappings`, `depMappingsOverrides`, or `instanceProvides` exists anywhere in the codebase (verified Aug 2026). Meanwhile, **`web/scripts/validate-di-deps.js`** (`npm run validate:di`) shipped in July 2026 — its header cites this very plan — and now **CI-gates the exact silent-failure class this plan was written to kill**: declared-but-undeliverable deps (the `clearAllUndoHistory` March-2026 bug class) are gated at **0**, alongside used-but-undeclared (**0**) and resolvable-nowhere (**0**), plus a ratchet on unused declarations.

That removes most of this plan's urgency. The trap still exists *structurally* — `depMappings` remains a hand-maintained object — but forgetting an entry is now caught statically in CI before it ships, not by a user reporting a dead button. **Re-scope: deferred.** Revisit only if the maintenance cost of the hand-written `depMappings` grows enough to justify the ~12–19h build (the Decision Criteria below now sit *behind* the CI gate as a second line of defense).

The June-2026 accuracy review that used to live here as a standalone correction block has been folded into the body below (design notes on the instance-vs-call discriminator, override-map sizing, and `findProvidedValue()` appear inline where they matter). One historical caveat worth keeping visible: the `startGuidedTour` incident was actually a missing manifest `lazyRequires` declaration, not a missing `depMappings` entry — auto-generation would **not** have prevented that specific case, so the "auto-gen kills the whole class" framing was always slightly overstated.

> Line-number pins from earlier revisions of this doc have all drifted; anchors below are symbol names — search for them in `modules/boot/moduleLoader.js`.

---

## Goal

Eliminate the silent-failure bug class where a module declares a dep in its manifest (`requires` / `optionalDeps` / `lazyRequires`) but it has no corresponding entry in the `depMappings` object in `moduleLoader.js` — leaving the consumer to fall back to its `optional()` default forever, with no error.

The proposed approach: **derive `depMappings` from the manifests' `provides` declarations at boot time**, instead of maintaining a separate hand-written object. The manifest becomes the single source of truth.

---

## Why This Is Worth Doing

### The trap exists today

`depMappings` (in [`web/modules/boot/moduleLoader.js`](../../modules/boot/moduleLoader.js), anchor: `const depMappings`) is a hand-maintained object literal with ~230 entries (as of v2.412) that look like:

```javascript
const depMappings = {
    isModalOpen: () => deps.ui?.modalManager?.isModalOpen?.(),
    startGuidedTour: (...args) => deps.ui?.startGuidedTour?.(...args),
    loadMiniCycle: (...args) => deps.cycle?.loadMiniCycle?.(...args),
    // ... ~230 more
};
```

Every time a new dep is added to a module's manifest, a matching entry must also be added here, by hand. If forgotten, the consumer's `this.deps.X` resolves to `undefined` and any `?.()` call silently no-ops.

### Recurring incident pattern

Three of the same bug class hit production code:

| Date | Dep | Reporter |
|------|-----|----------|
| March 2026 | `clearAllUndoHistory` | "Clear Undo History button does nothing" |
| April 2026 | `startGuidedTour` | "SVG Start Tour button does nothing for 3+ seconds" — *caveat: this one was a missing manifest `lazyRequires` declaration, not a missing `depMappings` entry; auto-generation would not have prevented it* |
| April 2026 | `isOverlayActive` | "Swipes work even with onboarding modal open" |

A one-shot audit ([Option 4 from April 2026 session](../../../web/modules/boot/moduleLoader.js)) found **8 HIGH-severity gaps** and **24 MEDIUM-severity dead declarations** in active manifests. Those have been plugged manually (April 2026), but the underlying pattern guarantees more in the future.

A boot-time warning was added (April 2026, the `WARN_ON_UNMAPPED_DECLARED_DEPS` flag in moduleLoader.js) to make new gaps visible at runtime — but that's reactive, not preventative. Since July 2026, `npm run validate:di` catches the class statically in CI (including the supply-side "declared-but-undeliverable" bucket no runtime warning could see) — see the status section at the top.

### What auto-generation buys

If `depMappings` is derived from manifest data, **you can't forget to add an entry** because there's no entry to forget. Adding a new dep to a manifest's `provides` automatically registers it for any consumer that declares it in `requires` / `optionalDeps` / `lazyRequires`.

---

## Current Architecture

```
┌─────────────────────┐         ┌───────────────────────┐         ┌──────────────┐
│ moduleManifests.js  │         │ moduleLoader.js       │         │ Consumer     │
│                     │         │                       │         │              │
│ moduleA: {          │         │ const depMappings = { │         │ this.deps.X  │
│   requires: ['X'],  │────────▶│   X: () => deps.api   │────────▶│   .()        │
│   ...               │         │     ?.X?.(...args)    │         │              │
│ }                   │         │ }                     │         └──────────────┘
│                     │         │                       │
│ moduleB: {          │         │  ↑                    │
│   provides: ['X'],  │   ?     │  HAND-MAINTAINED     │
│   ...               │   ━ ━ ━ ▶  no link back to     │
│ }                   │         │   moduleB.provides   │
└─────────────────────┘         └───────────────────────┘
```

The manifest declares `provides: ['X']`, but `depMappings` is *separately* declared. Nothing links them.

## Proposed Architecture

```
┌─────────────────────┐         ┌───────────────────────┐         ┌──────────────┐
│ moduleManifests.js  │         │ moduleLoader.js       │         │ Consumer     │
│                     │         │                       │         │              │
│ moduleA: {          │         │ // Auto-generated     │         │ this.deps.X  │
│   requires: ['X'],  │────────▶│ const depMappings =   │────────▶│   .()        │
│   ...               │         │   buildDepMappings(   │         │              │
│ }                   │         │     manifests, deps); │         └──────────────┘
│                     │   ┌────▶│                       │
│ moduleB: {          │   │     │  ↑ derived from       │
│   provides: ['X'],  │ ━ ┘     │   provides + apiCategory │
│   ...               │         │                       │
│ }                   │         │                       │
└─────────────────────┘         └───────────────────────┘
```

The single source of truth is the manifest's `provides` + `api` (deps category). `depMappings` is derived.

---

## Design

### Algorithm

```javascript
function buildAutoDepMappings(manifestRegistry, deps) {
    const mappings = {};

    for (const [moduleName, manifest] of Object.entries(manifestRegistry)) {
        if (!manifest.provides) continue;

        const category = getDepsCategoryForModule(manifest);  // 'ui', 'task', etc.

        for (const provided of manifest.provides) {
            if (mappings[provided]) {
                console.warn(`⚠️ Duplicate dep mapping for "${provided}" — ${moduleName} conflicts with prior provider`);
                continue;
            }

            // Default mapping: pass-through call to the registered API.
            // For provideInstance modules, exposes the instance via call: () => deps.X.instance
            const isInstanceProvider = manifest.provideInstance === provided;

            mappings[provided] = isInstanceProvider
                ? () => deps[category]?.[provided]
                : (...args) => deps[category]?.[provided]?.(...args);
        }
    }

    return mappings;
}
```

**⚠️ Known flaw in this sketch (June 2026 review — must be fixed before building):** the `manifest.provideInstance === provided` discriminator is broken against the real manifest shape. Across all `provideInstance` declarations (~29 as of v2.412), the instance name lives *outside* its own `provides` array (e.g. `statsPanel`: `provideInstance: 'statsPanelManager'`, `provides: ['showStatsPanel', …]`; essentially only `vocabThemes` has the name in both) — so that test is almost always false and the sketch would silently never emit the ~29 instance-name deps that consumers (`historyManager`, `statsPanelManager`, `achievementsManager`, `vocabThemeManager`, …) depend on. Consequences:

- `provideInstance` must be iterated as a **separate source** of mappings, not tested for membership in `provides`.
- Runtime type detection ("if the value is a function, wrap it") **cannot work**: `depMappings` is built before any instance exists — its closures aren't invoked at build time, and `ensureDepMappingKeys()` (exported from moduleLoader.js) relies on exactly that. The `instanceProvides` / `callProvides` manifest hints below are therefore **required, not optional**.
- Several instance deps are **method-binding Proxies** today (`historyManager`, `clearedTasksManager`, `achievementsManager`, `vocabThemeManager`, …) to preserve `this`. A naive `() => deps[cat]?.[name]` breaks them — the generator must reproduce the binding.

### Override hooks for special cases

A small number of current depMappings entries do non-trivial things — they're not just pass-throughs. Examples:

- **Validated lazy wrappers**: `closeAllModals: createValidatedWrapper(...)` — adds runtime validation
- **Aliased / nested access**: `isModalOpen: () => deps.ui?.modalManager?.isModalOpen?.()` — calls a method on a nested instance
- **Multi-source resolution**: `createInitialSchema25Data` now falls back across **three** sources (`deps.core || deps.utils || deps.cycle` — grown from two since this plan was written; multi-source entries accrete). Others: `sanitizeInput`, `removeRecurringTasksFromCycle`, `hideMainMenu`
- **Special call signatures**: e.g., partial application, default args, the `deferredInvoke`-based `unlockMiniGame`
- **No provider module at all**: the DOM-helper CORE_DEPS wrap `document` directly — must stay static overrides

For these, support an **override map** that runs after auto-generation:

```javascript
const depMappingsOverrides = {
    // Override the auto-generated default for these specific deps
    closeAllModals: createValidatedWrapper('closeAllModals', () => deps.ui?.modalManager?.closeAllModals),
    isModalOpen: () => deps.ui?.modalManager?.isModalOpen?.(),
    // ...
};

const depMappings = { ...buildAutoDepMappings(...), ...depMappingsOverrides };
```

The override map is realistically **~60–80 entries** (June 2026 sizing — not the ~20–30 originally hoped): beyond the named special cases, many entries resolve to a nested sub-API rather than `deps[category][providedName]` (recurring fns via `deps.recurring.core` / `deps.recurring.panel`; completed-tasks/help/gestures via `deps.ui.<manager>.<method>`), and multi-source fallbacks, method-binding Proxies, instance accessors, and the DOM-helper CORE_DEPS all need overrides too. Overrides win because they're applied last via spread.

### Manifest hint for instance vs function

For modules that provide both an instance AND functions on that instance, add an explicit declaration to the manifest:

```javascript
recurringPanel: {
    // ... usual fields
    provides: ['panel', 'core'],
    provideInstance: 'recurringPanel',
    instanceProvides: ['panel'],   // these resolve to instance accessors
    callProvides: ['core'],         // these resolve to method-call wrappers
}
```

~~Or simpler: detect by inspecting the value type at runtime. If `deps[category][name]` is a function, build a call-wrapper; if it's an object, return it as-is.~~ **This fallback cannot work** (see the flaw note under the Algorithm): `depMappings` is built before any instance exists, so there is no value to inspect. The explicit manifest hints are required.

---

## Migration Path

### Phase 1: Build the auto-mapper alongside existing depMappings (one PR)

- Implement `buildAutoDepMappings()`
- Generate it at boot, store as `_autoMappings`
- Add a comparison check in dev: log warnings when a manifest's `provides` doesn't match the corresponding `depMappings` entry
- This catches drift between the two sources without changing behavior

### Phase 2: Migrate trivial entries (one PR per category)

For each api category (ui, task, cycle, etc.):
- Identify entries in `depMappings` that match the auto-generated default (pure pass-through)
- Delete those entries from the hand-written `depMappings`
- Verify nothing breaks

After all categories are migrated, the hand-written `depMappings` only contains the override cases.

### Phase 3: Switch to auto + overrides (one PR)

```javascript
// Before:
const depMappings = { /* ~230 entries (as of v2.412) */ };

// After:
const depMappings = {
    ...buildAutoDepMappings(manifestRegistry, deps),
    ...depMappingsOverrides,  // ~60-80 entries for special cases (June 2026 sizing) — NOT ~30
};
```

### Phase 4: Cleanup (one PR)

- Remove the dev comparison check from Phase 1
- Document the override pattern in the developer guide
- Remove the `WARN_ON_UNMAPPED_DECLARED_DEPS` flag if appropriate (auto-gen makes its trigger condition impossible)

---

## Risks & Tradeoffs

### Risk: Performance overhead at boot

`buildAutoDepMappings()` walks ~57 provider modules (as of v2.412) × ~5 provides each ≈ ~300 iterations. Negligible (<1ms).

### Risk: Auto-generated entries miss subtle behavior

Some current entries do things the auto-generator wouldn't replicate (e.g., the validated wrappers). Mitigation: the override map handles all special cases. If anything breaks during Phase 2, that entry just gets added to overrides.

### Risk: API category boundaries shift over time

`getDepsCategoryForModule()` reads `manifest.api` to know whether to look in `deps.ui`, `deps.task`, etc. If a module's category changes, the auto-generated mapping changes too. Mitigation: this is *desired* behavior — it stays in sync automatically.

### Risk: Duplicate `provides` across modules

If two modules declare `provides: ['someName']`, the auto-generator currently picks one and warns. Today's `depMappings` would also be ambiguous in that case. Solve by enforcing unique `provides` names at manifest validation time — and note this is **net-new work**: nothing enforces uniqueness today. `findProvidedValue()` (moduleLoader.js) resolves one name against one instance with no cross-module awareness, and the provider map silently last-write-wins on duplicates. Build the check into `buildAutoDepMappings` (the pseudocode's warn-and-skip is a start) or into manifest validation.

### Tradeoff: Less flexibility for one-off wrappers

Current pattern lets you write any function as a depMapping. Auto-generation forces you into either "default pattern" or "override map." Most cases fit the default; the override map handles the rest. Acceptable trade.

---

## Estimated Effort

- **Phase 1** (auto-mapper + dev comparison): 4-6 hours
- **Phase 2** (migrate categories): 4-8 hours total across N PRs
- **Phase 3** (switch over): 2-3 hours
- **Phase 4** (cleanup + docs): 2 hours

**Total**: ~12-19 hours of work, spread across multiple PRs to limit blast radius.

---

## Prerequisites

- ✅ Boot-time warning for unmapped declared deps (`WARN_ON_UNMAPPED_DECLARED_DEPS`) — implemented April 2026
- ✅ One-shot audit closing existing gaps — completed April 2026
- ✅ Static CI gate for the bug class (`scripts/validate-di-deps.js`, `npm run validate:di`) — shipped July 2026; gated at undeclared=0, nowhere=0, undeliverable=0 (this is what re-scoped the plan to "deferred")
- ⚠️ `ENFORCE_REQUIRES` rollout (per [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md)) — should happen first OR concurrently. With `ENFORCE_REQUIRES = true` AND auto-generated depMappings, the system is fully self-validating: declared deps must be in `requires`/`optionalDeps`/`lazyRequires`, and they automatically resolve from `provides`.

---

## Decision Criteria for Starting

Start this plan when **any one** of these is true:

1. Another silent-failure bug from a missing `depMappings` entry surfaces in production **despite** the `validate:di` CI gate (would indicate a gap in the static parse)
2. The number of manual `depMappings` entries crosses ~500 (~230 as of v2.412)
3. ENFORCE_REQUIRES rollout reaches Phase 4 (the architectural cleanup phase)
4. A new contributor joins and trips on the trap when adding their first cross-module dep

Until then, the CI gate (`npm run validate:di`) + boot-time warning + closed gaps from April 2026 keep the bug class contained.

---

## See Also

- Memory: [feedback_di_consumer_surface.md](../../../../.claude/projects/-Users-mjaynumberone-Documents-Programs-Code-miniCycle/memory/feedback_di_consumer_surface.md) — the lessons-learned from prior occurrences
- Code: [moduleLoader.js depMappings](../../modules/boot/moduleLoader.js) (search for `const depMappings`)
- Code: [moduleManifests.js](../../modules/boot/moduleManifests.js)
- Code: [scripts/validate-di-deps.js](../../scripts/validate-di-deps.js) — the shipped static gate that mitigates this plan's bug class (`npm run validate:di`)
- Plan: [ENFORCE_REQUIRES_ROLLOUT_PLAN.md](../archive/ENFORCE_REQUIRES_ROLLOUT_PLAN.md) — strict mode rollout, complementary to this plan
