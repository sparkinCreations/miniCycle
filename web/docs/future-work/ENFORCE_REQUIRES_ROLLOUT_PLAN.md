# ENFORCE_REQUIRES Rollout Plan

**Date:** March 15, 2026
**Status:** Not Started
**Prerequisite:** DI manifest tightening (Complete — March 2026)
**Related:** [DI_MIGRATION_COMPLETION_PLAN.md](./DI_MIGRATION_COMPLETION_PLAN.md) (Phase 5, effectively)

---

## Goal

Flip `ENFORCE_REQUIRES` to `true` in `moduleLoader.js` so that each module **only receives dependencies it explicitly declares** in its manifest (`requires`, `optionalDeps`, `lazyRequires`). Today the flag is `false` (line 136), meaning all ~368 `depMappings` entries are spread into every module regardless of declarations.

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

Add unconditional injection of `CORE_DEPS` into the `result` object in `buildDependencies()`, before the `ENFORCE_REQUIRES` check:

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

**Location:** `moduleLoader.js`, inside `buildDependencies()`, before line 1053.
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
| **Smaller dep objects** | Modules receive ~5-20 deps instead of ~368 — less memory, clearer debugging |
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

## Current State (March 2026)

| Item | Status |
|------|--------|
| Manifest tightening (30 modules) | Complete |
| CORE_DEPS expanded with DOM helpers | Complete |
| CORE_DEPS injection in strict mode | **Not started** (Step 1) |
| Audit mode cleanup | **Not started** (Step 2) |
| Per-phase enforcement | **Not started** (Step 3) |
| Global flag flip | **Not started** (Step 4) |

---

## Files Involved

| File | Role |
|------|------|
| `modules/boot/moduleLoader.js` (line 136) | `ENFORCE_REQUIRES` flag |
| `modules/boot/moduleLoader.js` (line 129) | `AUDIT_UNDECLARED_DEPS` flag |
| `modules/boot/moduleLoader.js` (~line 1053) | Enforcement/injection logic |
| `modules/boot/moduleManifests.js` (line 631+) | `CORE_DEPS` definition |
| `modules/boot/moduleManifests.js` | All module manifests |
