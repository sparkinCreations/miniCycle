# Error Handling — Remaining Phases (3–5)

> Carved out of the original 5-phase **Error Handling Improvements Plan** (Dec 2025).
>
> **Phases 1–2 shipped (Jun 2026)** — feature-availability tracking + data-corruption recovery.
> See [ERROR_RECOVERY.md](../developer-guides/ERROR_RECOVERY.md) for the implemented behavior, and
> [`../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md`](../archive/ERROR_HANDLING_IMPROVEMENTS_PLAN.md)
> for the full original plan including the detailed Phase 3–5 implementation specs.
>
> Phases 3–5 below are **open / deferred** (not yet scheduled). Each is low–medium effort.

---

## Phase 3 — Transaction Atomicity
**Effort:** Medium (~2h) · **Risk:** Medium · **Impact:** prevents partial state corruption

Multi-step operations (e.g. cycle creation: create cycle → set `activeCycleId` → update settings) can
partially fail and leave inconsistent state. Add an all-or-nothing wrapper so a mid-sequence failure
rolls back. Full spec: archived plan, "Phase 3".

## Phase 4 — Actionable Timeout Errors
**Effort:** Low (~1h) · **Risk:** Low · **Impact:** users can diagnose boot issues

Boot timeouts show generic messages (`"Phase 2 timed out after 20000ms"`). Enrich with which
module/phase stalled and a suggested next step. Full spec: archived plan, "Phase 4".

## Phase 5 — Error Context Preservation
**Effort:** Low (~1h) · **Risk:** Low · **Impact:** better debugging

Catch blocks log `error.message` with no context about *what* operation failed. Thread an operation
label/context through catch sites. Full spec: archived plan, "Phase 5".

---

> Target from the original plan: raise the error-handling score from 92→98/100. Phases 1–2 covered the
> two HIGH-severity gaps (silent feature failures, data-corruption recovery); 3–5 are the
> medium/low remainder.
