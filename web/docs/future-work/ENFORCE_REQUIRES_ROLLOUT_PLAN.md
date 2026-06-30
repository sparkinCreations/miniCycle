# ENFORCE_REQUIRES Rollout Plan

**Date:** March 15, 2026
**Status:** Not Started
**Prerequisite:** DI manifest tightening (Complete — March 2026)
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](./DI_MIGRATION_COMPLETION_PLAN.md) (Phase 5, effectively)

---

## ⚠️ Accuracy Correction — June 29, 2026

This plan was written March 15, 2026 and predates commit `00c727b3` (Apr 27), which rewrote the DI region of `moduleLoader.js`. **The strategy below is still sound** — nothing in the current code blocks it — but the specifics drifted. Treat all line numbers as June-2026 snapshots and prefer the symbol anchors. Where this block conflicts with the prose below, **this block wins.**

**Update — June 30, 2026:** item 2 below (`optionalDeps` injection) is now **implemented** (commit `6c373122`). That change added the `injectDeclaredDeps` helper, shifting line numbers below `buildModuleDependencies` by ~+26 (e.g. the broad `Object.assign` moved L1374 → L1400) — rely on the **symbol anchors**, not the table's numbers, for anything past ~L770.

**Corrected anchors** (`modules/boot/moduleLoader.js` unless noted):

| Reference in plan | Current location |
|---|---|
| `ENFORCE_REQUIRES` "line 136" | `const ENFORCE_REQUIRES` @ **L148** (L136 is a doc-comment) |
| `AUDIT_UNDECLARED_DEPS` "line 129" | `const AUDIT_UNDECLARED_DEPS` @ **L141** |
| `Object.assign(result, depMappings)` "line 1056" | **L1374**, guarded by `if (!ENFORCE_REQUIRES)` @ L1373 |
| validation suppression "line 1046" | **L1344** (+ a third CORE_DEPS-aware site at L1362) |
| audit-proxy suppression "line 1079" | **L1397** |
| `warnedProps` "line 1082" | **L1390** |
| `CORE_DEPS` "moduleManifests.js line 631+" | **moduleManifests.js L701–731** (28 entries: 6 DOM helpers + `getTaskList`/`getProgressBar`) |
| function `buildDependencies()` | never existed — the real function is **`buildModuleDependencies()`** @ L771 |
| "~368 depMappings entries" | **~221** top-level entries (L836–1311); the "~5–20 instead of ~368" benefit is overstated ~60% |

**Substantive corrections to the rollout:**

1. **Step 1 is narrower than written.** Phase-1 boot CORE_DEPS (`AppState`, `appInit`, `GlobalUtils`, `AppGlobalState`, `FeatureFlags`, `AppMeta`) are *already* injected unconditionally at L776–833, before the flag check — the "CORE_DEPS not injected in strict mode" framing is too broad. The Step 1 loop only needs to cover the **depMappings-sourced** CORE_DEPS (DOM helpers, `sanitizeInput`, etc.); drop the `coreResult` branch from the pseudocode — it's dead. Insert the loop **before the broad `Object.assign` at L1374**, not "before line 1053."

2. **✅ DONE (June 30, 2026, commit `6c373122`) — `optionalDeps` are now injected.** The original gap: the inline copy loops handled only `requires` and `lazyRequires`, so `optionalDeps` arrived *solely* via the broad `Object.assign(result, depMappings)` that Step 4 deletes — meaning every `optionalDeps`-declared dep would have silently become `undefined` the instant the flag flipped (a wide blast radius, given how heavily modules lean on `optional()`). The fix extracted all three buckets into an exported pure helper, **`injectDeclaredDeps(result, manifest, depMappings, coreResult)`** (injects `requires` + `optionalDeps` + `lazyRequires` identically), called from `buildModuleDependencies()`. It is behavior-neutral under the current `ENFORCE_REQUIRES=false` (the broad assign still overwrites with identical values) and only changes the strict-mode path. A unit test (`tests/moduleLoader.tests.js` → "injects requires, optionalDeps AND lazyRequires") guards it. **This was the single most important gap in the original plan; the remaining Step 1 blocker is the depMappings-sourced CORE_DEPS injection in item 1 above — still not done, and the last thing preventing a successful strict boot.**

3. **Step 2 can lean on the existing WARN flag.** `WARN_ON_UNMAPPED_DECLARED_DEPS` (L162, currently `true`; warn block L1355–1369) already surfaces undeclared/unmapped deps at boot with far less noise than the `AUDIT_UNDECLARED_DEPS` Proxy. Prefer extending it over cleaning up the Proxy.

4. **Manifests are closer to flip-ready than "Why Not Now" implies.** The April 2026 audit (see [AUTO_GENERATED_DEPMAPPINGS_PLAN.md](./AUTO_GENERATED_DEPMAPPINGS_PLAN.md)) already plugged 8 HIGH + 24 MEDIUM declaration gaps.

---

## Goal

Flip `ENFORCE_REQUIRES` to `true` in `moduleLoader.js` so that each module **only receives dependencies it explicitly declares** in its manifest (`requires`, `optionalDeps`, `lazyRequires`). Today the flag is `false` (L148), meaning all ~221 `depMappings` entries are spread into every module regardless of declarations.

---

## Why Not Now

As of March 2026, manifests are significantly tighter (30 modules updated, `CORE_DEPS` expanded with DOM helpers), but flipping the flag globally is premature for three reasons:

### 1. CORE_DEPS are not injected in strict mode

`CORE_DEPS` entries (e.g., `getElementById`, `querySelector`, `getBody`) suppress audit warnings (line 1079) and skip validation warnings (line 1046), but they are **not automatically injected** into `result` when `ENFORCE_REQUIRES = true`. The broad `Object.assign(result, depMappings)` at line 1056 only runs when the flag is `false`.

This means every module that uses a DOM helper without declaring it in its manifest would get `undefined` and throw — despite DOM helpers being designated as "always available framework infrastructure."

**Fix required:** Before the flag is flipped, the loader must inject `CORE_DEPS` entries into `result` unconditionally. This is not a simple 4-line loop because `CORE_DEPS` entries come from different sources:
- DOM helpers (`getElementById`, `querySelector`, etc.) → from `depMappings` (direct `document` calls)
- `AppState` → from `coreResult` (Phase 1 boot output)
- `showNotification`, `safeAddEventListener`, etc. → from `depMappings` (module exports)

The injection logic must pull from the correct source for each entry.

### 2. Audit mode is too noisy to verify completeness

`AUDIT_UNDECLARED_DEPS` (line 129) wraps deps in a Proxy that logs undeclared access. In practice it generates false positives from:
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

**Location:** `moduleLoader.js`, inside `buildModuleDependencies()` (L771), before the broad `Object.assign(result, depMappings)` at L1374. (See correction block: only the depMappings-sourced CORE_DEPS need this — the `coreResult`-sourced ones are already injected at L776–833; and add an `optionalDeps` copy loop here too.)
**Risk:** Low — only adds deps that were already available via broad injection.
**Verification:** Boot app, confirm all DOM helpers resolve, run tests.

### Step 2: Clean up audit mode

Reduce false positives in the `AUDIT_UNDECLARED_DEPS` Proxy:

- **Filter DevTools enumeration:** Ignore `Symbol` properties and known JS internal properties beyond the current allowlist
- **Debounce/deduplicate:** Already partially done (line 1082 `warnedProps`), but consider grouping output per module instead of per-access
- **Add structured output:** Log as structured JSON so results can be piped to a validation script rather than read manually from console

**Goal:** Enable `AUDIT_UNDECLARED_DEPS = true` during development without drowning in noise, so developers can catch undeclared deps as they add them.

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

## Current State (updated June 30, 2026)

| Item | Status |
|------|--------|
| Manifest tightening (30 modules) | Complete |
| CORE_DEPS expanded with DOM helpers | Complete |
| `optionalDeps` injection in strict mode (Step 1a) | **Complete** (June 30, 2026 — commit `6c373122`, `injectDeclaredDeps`) |
| CORE_DEPS injection in strict mode (Step 1b) | **Not started** — last Step 1 blocker before a strict boot can succeed |
| Audit mode cleanup | **Not started** (Step 2) |
| Per-phase enforcement | **Not started** (Step 3) |
| Global flag flip | **Not started** (Step 4) |

---

## Files Involved

| File | Role |
|------|------|
| `modules/boot/moduleLoader.js` (L148) | `ENFORCE_REQUIRES` flag |
| `modules/boot/moduleLoader.js` (L141) | `AUDIT_UNDECLARED_DEPS` flag |
| `modules/boot/moduleLoader.js` (L162) | `WARN_ON_UNMAPPED_DECLARED_DEPS` flag (boot-time gap warnings) |
| `modules/boot/moduleLoader.js` (`injectDeclaredDeps` L785; `buildModuleDependencies` L808; broad inject L1400) | Enforcement/injection logic |
| `modules/boot/moduleManifests.js` (L701–731) | `CORE_DEPS` definition |
| `modules/boot/moduleManifests.js` | All module manifests |

> Line numbers above are June-2026 snapshots; prefer the symbol names when they drift.
