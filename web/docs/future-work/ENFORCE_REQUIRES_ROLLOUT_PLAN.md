# ENFORCE_REQUIRES Rollout Plan

**Date:** March 15, 2026
**Status:** ✅ **SHIPPED — `ENFORCE_REQUIRES = true` since August 2026.** Step 1 landed June 2026; Step 2's goal was covered statically by `npm run validate:di`; Steps 3–4 (`STRICT_PHASES`, per-phase rollout) were **never built and are no longer needed** — the whole-app flip passed in one go once the facade forward-through gaps were declared.

> **What the phased rollout was insurance against, and what actually happened.**
> The blocker was never a phase-ordering problem, so enforcing per phase would not
> have found it faster. It was **facade forward-through**: `taskDOM` and `taskCore`
> hand deps to dynamically imported sub-modules that are deliberately absent from
> the manifest, and nothing declared them. Every failure was silent — an absent dep
> makes `deps.foo?.()` no-op — so all four failing journeys reported only a 10s
> `waitForFunction` timeout.
>
> Fixed in v2.418: taskDOM's 24 forwarded deps, taskCore's 13 (the task-creation
> chain, a series of early-return guards where one missing link killed every add),
> and taskDOM's three self-routed names. `setupRecurringButtonHandler` was the last
> and quietest: undeclared, the recurring button's listener never attached, so the
> click did nothing with no error and no warning anywhere.
>
> Two `validate:di` blind spots had to be closed on the way: it models specific
> dep-accessor shapes, and both `this._rawDeps.X` and the
> `const resolvedDeps = di.resolve(...)` alias were invisible to it. A new accessor
> shape is a new blind spot. Teaching it the second one also surfaced a real
> pre-existing gap (`labelResolver`'s `isTouchDevice` override).
>
> **To revert:** set `ENFORCE_REQUIRES = false`. Behaviour-neutral — every
> declaration added for strict mode is inert under the broad assign.

**Prerequisite:** DI manifest tightening (Complete — March 2026)
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](../archive/DI_MIGRATION_COMPLETION_PLAN.md) (Phase 5, effectively)

---

## ⚠️ Accuracy Correction — June 29, 2026

This plan was written March 15, 2026 and predates commit `00c727b3` (Apr 27), which rewrote the DI region of `moduleLoader.js`. **The strategy below is still sound** — nothing in the current code blocks it — but the specifics drifted. Treat all line numbers as June-2026 snapshots and prefer the symbol anchors. Where this block conflicts with the prose below, **this block wins.**

**Update — June 30, 2026:** **all of Step 1 is now implemented** — item 2 (`optionalDeps` injection, commit `6c373122`, helper `injectDeclaredDeps`) and item 1 (CORE_DEPS strict-mode injection, commit `ec110544`, helper `injectCoreDeps`). Both helpers run in `buildModuleDependencies()` before the broad `Object.assign` fallback.

**Corrected anchors** (`modules/boot/moduleLoader.js` unless noted). Line numbers rot — every previously pinned number in this doc has drifted at least once (verified Aug 2026) — so anchors below are **symbol names**; search for them.

| Reference in plan | Current anchor |
|---|---|
| `ENFORCE_REQUIRES` "line 136" | `const ENFORCE_REQUIRES` (now `true` — shipped Aug 2026) |
| `AUDIT_UNDECLARED_DEPS` "line 129" | `const AUDIT_UNDECLARED_DEPS` (currently `false`) |
| `WARN_ON_UNMAPPED_DECLARED_DEPS` | `const WARN_ON_UNMAPPED_DECLARED_DEPS` (currently `true`) |
| `Object.assign(result, depMappings)` "line 1056" | inside `buildModuleDependencies()`, guarded by `if (!ENFORCE_REQUIRES)` |
| validation / audit-proxy suppression, `warnedProps` | inside `buildModuleDependencies()` (CORE_DEPS-aware) |
| `CORE_DEPS` "moduleManifests.js line 631+" | `export const CORE_DEPS` in **moduleManifests.js** (28 entries as of v2.412: 6 DOM helpers + `getTaskList`/`getProgressBar` + framework deps). Note: two entries are now dual-annotated "from coreBoot; **also a depMappings key**" — `DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS` and `performSchema25Migration`. |
| function `buildDependencies()` | never existed — the real function is **`buildModuleDependencies()`** |
| "~368 depMappings entries" | **~230** top-level entries (see `const depMappings` in moduleLoader.js); the "~5–20 instead of ~368" benefit is overstated ~60% |

**Substantive corrections to the rollout:**

1. **✅ DONE (June 30, 2026, commit `ec110544`) — CORE_DEPS are now injected in strict mode.** The original framing ("CORE_DEPS not injected in strict mode") was too broad: 6 of 28 CORE_DEPS (`AppState`, `appInit`, `GlobalUtils`, `AppGlobalState`, `FeatureFlags`, `AppMeta`) are *already* set unconditionally by the Phase-1 prologue of `buildModuleDependencies()`. A classification confirmed the other 22 are **depMappings keys** and that **none of the 6 Phase-1 names are depMappings keys** (0 unaccounted) — so the pseudocode's `coreResult` fallback was dead and was dropped. The fix is the exported helper **`injectCoreDeps(result, CORE_DEPS, depMappings)`**: it sets each CORE_DEP that is a depMappings key, leaving the 6 Phase-1 deps (incl. the `AppState` Proxy) untouched because they aren't depMappings keys. Behavior-neutral under `ENFORCE_REQUIRES=false`; only matters in strict mode. Guarded by unit tests (`tests/moduleLoader.tests.js`) including a `key-presence (in) not truthiness` test and a cross-file invariant test asserting the 6 Phase-1 names never become depMappings keys. A 4-lens adversarial review confirmed correctness (behavior-neutrality, no AppState clobber, placement). **Caveat:** this does NOT make a strict boot safe yet — modules still access ~208 non-CORE depMappings entries that strict mode would drop unless declared (the job of Steps 2–3 + the facade forward-through declarations).

2. **✅ DONE (June 30, 2026, commit `6c373122`) — `optionalDeps` are now injected.** The original gap: the inline copy loops handled only `requires` and `lazyRequires`, so `optionalDeps` arrived *solely* via the broad `Object.assign(result, depMappings)` that Step 4 deletes — meaning every `optionalDeps`-declared dep would have silently become `undefined` the instant the flag flipped (a wide blast radius, given how heavily modules lean on `optional()`). The fix extracted all three buckets into an exported pure helper, **`injectDeclaredDeps(result, manifest, depMappings, coreResult)`** (injects `requires` + `optionalDeps` + `lazyRequires` identically), called from `buildModuleDependencies()`. It is behavior-neutral under the current `ENFORCE_REQUIRES=false` (the broad assign still overwrites with identical values) and only changes the strict-mode path. A unit test (`tests/moduleLoader.tests.js` → "injects requires, optionalDeps AND lazyRequires") guards it. **This was the single most important gap in the original plan.** (Item 1 above — the CORE_DEPS strict-mode injection — is now also done, so all of Step 1 is complete.)

3. **Step 2 is now largely superseded by static tooling.** `WARN_ON_UNMAPPED_DECLARED_DEPS` (currently `true`) surfaces declared-but-unmapped deps at boot, and — decisively — `scripts/validate-di-deps.js` (`npm run validate:di`, added July 2026, CI-gated) catches used-but-undeclared and declared-but-undeliverable deps statically. See the rewritten Step 2 below.

4. **Manifests are closer to flip-ready than "Why Not Now" implies.** The April 2026 audit (see [AUTO_GENERATED_DEPMAPPINGS_PLAN.md](./AUTO_GENERATED_DEPMAPPINGS_PLAN.md)) already plugged 8 HIGH + 24 MEDIUM declaration gaps.

---

## Goal

Flip `ENFORCE_REQUIRES` to `true` in `moduleLoader.js` so that each module **only receives dependencies it explicitly declares** in its manifest (`requires`, `optionalDeps`, `lazyRequires`). **Achieved August 2026** — see the status banner at the top. Everything below this line documents the plan as it stood before the flip; the "Why Not Now" reasoning and Steps 2–4 are kept as the historical record, not as outstanding work.

---

## Why Not Now

As of March 2026, manifests are significantly tighter (30 modules updated, `CORE_DEPS` expanded with DOM helpers), but flipping the flag globally is premature for three reasons:

### 1. CORE_DEPS are not injected in strict mode — ✅ RESOLVED June 2026 (see correction block; kept for history)

`CORE_DEPS` entries (e.g., `getElementById`, `querySelector`, `getBody`) suppress audit warnings (line 1079) and skip validation warnings (line 1046), but they are **not automatically injected** into `result` when `ENFORCE_REQUIRES = true`. The broad `Object.assign(result, depMappings)` at line 1056 only runs when the flag is `false`.

This means every module that uses a DOM helper without declaring it in its manifest would get `undefined` and throw — despite DOM helpers being designated as "always available framework infrastructure."

**Fix required:** Before the flag is flipped, the loader must inject `CORE_DEPS` entries into `result` unconditionally. This is not a simple 4-line loop because `CORE_DEPS` entries come from different sources:
- DOM helpers (`getElementById`, `querySelector`, etc.) → from `depMappings` (direct `document` calls)
- `AppState` → from `coreResult` (Phase 1 boot output)
- `showNotification`, `safeAddEventListener`, etc. → from `depMappings` (module exports)

The injection logic must pull from the correct source for each entry.

### 2. Audit mode is too noisy to verify completeness — ✅ MITIGATED July 2026 (`validate:di` provides the clean signal; see rewritten Step 2)

`AUDIT_UNDECLARED_DEPS` (`const AUDIT_UNDECLARED_DEPS`) wraps deps in a Proxy that logs undeclared access. In practice it generates false positives from:
- DevTools property enumeration (inspecting objects in console)
- Proxy traps firing on internal JS operations (`then`, `constructor`, etc.)
- Conditional dep access paths that only trigger in specific user flows

Without a clean audit signal, there's no reliable way to confirm all manifests are complete before flipping the flag. A noisy audit means real gaps hide among false positives.

### 3. No incremental enforcement path exists

The flag is all-or-nothing: every module gets strict enforcement or none do. If a single manifest is incomplete, that module breaks at runtime. There's no way to enforce per-module or per-phase to validate incrementally.

---

## Rollout Steps

### Step 1: Make CORE_DEPS truly injected in strict mode

Add unconditional injection of `CORE_DEPS` into the `result` object in `buildModuleDependencies()`, before the `ENFORCE_REQUIRES` check:

```javascript
// Always inject CORE_DEPS — these are framework-level, no manifest declaration needed
for (const coreDep of CORE_DEPS) {
    if (result[coreDep] === undefined) {
        // Try depMappings first (DOM helpers, utility functions)
        if (depMappings[coreDep] !== undefined) {
            result[coreDep] = depMappings[coreDep];
        }
        // Then try coreResult (AppState, other Phase 1 outputs)
        else if (coreResult && coreResult[coreDep] !== undefined) {
            result[coreDep] = coreResult[coreDep];
        }
    }
}
```

**Location:** `moduleLoader.js`, inside `buildModuleDependencies()`, before the broad `Object.assign(result, depMappings)` fallback. (See correction block: only the depMappings-sourced CORE_DEPS need this — the `coreResult`-sourced ones are already injected by the Phase-1 prologue; and add an `optionalDeps` copy loop here too. Shipped as `injectCoreDeps()` + `injectDeclaredDeps()`, both exported from moduleLoader.js.)
**Risk:** Low — only adds deps that were already available via broad injection.
**Verification:** Boot app, confirm all DOM helpers resolve, run tests.

### Step 2 (rewritten July/Aug 2026): Retire or shrink the audit Proxy — lean on `validate:di`

The original Step 2 wanted to clean up the `AUDIT_UNDECLARED_DEPS` runtime Proxy so its output could verify manifest completeness. That goal is now served **statically** by `scripts/validate-di-deps.js` (`npm run validate:di`), which runs in CI and is **gated**: `undeclared = 0`, `nowhere = 0`, `undeliverable = 0`, plus a ratchet on unused declarations. It catches every `this.deps.X` / `_deps.X` access with no manifest declaration — the exact class the Proxy was meant to surface — with zero runtime noise and no manual console reading. (Its header cites this plan; it also covers the supply side — declared-but-undeliverable — which no runtime warn flag could see.)

Remaining work here is **subtractive, not additive**:

- Keep `WARN_ON_UNMAPPED_DECLARED_DEPS` (currently `true`) as the boot-time complement for the declared-but-unmapped direction.
- Retire — or shrink to a debugging aid — the `AUDIT_UNDECLARED_DEPS` Proxy infrastructure. Its only residual value over `validate:di` is catching truly dynamic access patterns the static parse can't see; keep it only if such a case actually turns up.
- Do NOT invest in the originally planned Proxy improvements (DevTools filtering, structured JSON output) — that would duplicate what `validate:di` already does better.

**Goal:** manifest completeness verified by CI (`validate:di` green), not by runtime console auditing.

### Step 3: Add per-phase strict enforcement

Add a `STRICT_PHASES` set to `moduleLoader.js`:

```javascript
// Phases where ENFORCE_REQUIRES is active (incremental rollout)
const STRICT_PHASES = new Set([
    // Start with the simplest phases, expand as manifests are verified
    // PHASES.UTILITIES,
    // PHASES.PROGRESS,
]);
```

Modify the enforcement check:

```javascript
if (!ENFORCE_REQUIRES && !STRICT_PHASES.has(manifest.phase)) {
    Object.assign(result, depMappings);
}
```

This allows enforcing one phase at a time. Start with low-risk phases (utilities, progress), expand to task management, then UI, then recurring, and finally boot-adjacent code.

**Verification per phase:**
1. Enable the phase in `STRICT_PHASES`
2. Boot the app, exercise all features in that phase
3. Run full test suite
4. Fix any missing manifest declarations
5. Move to next phase

### Step 4: Flip the global flag

Once all phases are individually verified under strict enforcement:

1. Set `ENFORCE_REQUIRES = true`
2. Remove `STRICT_PHASES` (no longer needed)
3. Remove the `Object.assign(result, depMappings)` broad-injection path
4. Run full test suite + manual smoke test
5. Optionally remove `AUDIT_UNDECLARED_DEPS` infrastructure (its job is done)

---

## What Strict Enforcement Buys

| Benefit | Description |
|---------|-------------|
| **Explicit contracts** | Read a manifest → know exactly what a module depends on |
| **Safe refactoring** | Removing a dep from `depMappings` only affects modules that declare it |
| **Catch coupling early** | Undeclared dep access fails immediately, not silently |
| **Smaller dep objects** | Modules receive ~5-20 deps instead of ~221 — less memory, clearer debugging |
| **Documentation accuracy** | Manifests become the source of truth, not approximations |

---

## What It Costs

| Cost | Description |
|------|-------------|
| **Friction on new deps** | Every new dep access requires a manifest update |
| **Migration risk** | Any missed declaration is a runtime error |
| **No rollback without flag** | Once flipped, reverting requires setting the flag back to `false` |

The friction is intentional — it's the enforcement mechanism. The migration risk is mitigated by the per-phase rollout in Step 3.

---

## Current State (updated August 2026)

| Item | Status |
|------|--------|
| Manifest tightening (30 modules) | Complete |
| CORE_DEPS expanded with DOM helpers | Complete |
| `optionalDeps` injection in strict mode (Step 1a) | **Complete** (June 30, 2026 — commit `6c373122`, `injectDeclaredDeps`) |
| CORE_DEPS injection in strict mode (Step 1b) | **Complete** (June 30, 2026 — commit `ec110544`, `injectCoreDeps`) |
| Undeclared-dep detection (Step 2's goal) | **Covered by `npm run validate:di`** (CI-gated: undeclared=0, nowhere=0, undeliverable=0) — Proxy retirement itself optional, not started |
| Per-phase enforcement (`STRICT_PHASES`) | **Not started** (Step 3 — no `STRICT_PHASES` exists anywhere, verified Aug 2026) |
| Global flag flip | **Not started** (Step 4) |

---

## Files Involved

| File | Role |
|------|------|
| `modules/boot/moduleLoader.js` (`const ENFORCE_REQUIRES`) | Enforcement flag (currently `false`) |
| `modules/boot/moduleLoader.js` (`const AUDIT_UNDECLARED_DEPS`) | Runtime audit Proxy flag (currently `false`; candidate for retirement — see Step 2) |
| `modules/boot/moduleLoader.js` (`const WARN_ON_UNMAPPED_DECLARED_DEPS`) | Boot-time gap warnings flag (currently `true`) |
| `modules/boot/moduleLoader.js` (`injectDeclaredDeps`, `injectCoreDeps`, `buildModuleDependencies`, broad `Object.assign(result, depMappings)` fallback) | Enforcement/injection logic |
| `modules/boot/moduleManifests.js` (`export const CORE_DEPS`) | `CORE_DEPS` definition (28 entries as of v2.412; two dual-annotated as "from coreBoot; also a depMappings key": `DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS`, `performSchema25Migration`) |
| `modules/boot/moduleManifests.js` | All module manifests |
| `scripts/validate-di-deps.js` (`npm run validate:di`) | Static declaration validator — CI-gated; supplies the completeness signal Step 2 originally sought |

> Locate by symbol name, not line number — every line pin this doc has carried so far drifted within months.
