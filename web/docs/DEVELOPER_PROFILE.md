# Developer Profile

**Last Updated:** December 9, 2025

This document captures insights about the developer behind miniCycle to help with future collaboration and context continuity.

---

## Background

- **Day job:** Quality Inspector (full-time)
- **miniCycle:** Side project built in spare time
- **Development style:** Solo developer building production-grade software

---

## Working Style

### Strengths

1. **Architectural thinking** - Sees the whole system, not just immediate problems. Pushes back on suggestions that don't fit the existing design.

2. **Defensive by nature** - QA background shows in the code. Builds for failure scenarios: lite fallback, timeout safety, rollback on errors, graceful degradation.

3. **Methodical execution** - 1,458 tests don't happen by accident. Sustained discipline over time, maintained through refactors.

4. **Owns the architecture** - Knows why every piece exists. Can reason about tradeoffs. Doesn't treat own codebase as a black box.

5. **Questions assumptions** - Doesn't accept suggestions blindly. Validates against experience and existing patterns.

6. **Product thinking** - Not just engineering. Considers SEO, landing pages, user trust, distribution. Building a product, not just an app.

### Patterns

- **Fix → Ship → Document** - Doesn't get blocked by documentation. Uses it as consolidation after the work is done.
- **Infrastructure investment** - Pays upfront for maintainability. Testing, DI patterns, 2-phase init - built to last.
- **Consistency over shortcuts** - One pattern across the codebase, even if it takes longer initially.
- **Confidence without ego** - Lets the code speak. Doesn't defend defensively, just points to evidence.

---

## Technical Preferences

### Established Patterns (Don't Change Without Discussion)

1. **Strict Dependency Injection (DI-Pure)**
   - All modules use `set*Dependencies()` with `Object.defineProperties`
   - No `|| window.*` fallbacks in modules
   - Lazy getters for late-bound dependencies

2. **2-Phase Initialization**
   - Phase 1: Core systems ready (AppState + data)
   - Phase 2: App ready (all modules initialized)
   - `waitForCore()` and `waitForApp()` with timeout safety
   - *This pattern solved real timing problems during refactoring - keep it*

3. **AppGlobalState for Runtime Flags**
   - Centralized runtime state object
   - Internal flags consolidated here, not scattered `window.*` properties

4. **Test Infrastructure**
   - Browser-runnable tests (source of truth)
   - Playwright automation layer on top
   - localStorage protection during tests
   - ~1,458 tests, 100% pass rate expected

5. **Lite Fallback**
   - Catastrophic failure safety net
   - HTML timeout triggers redirect if boot fails
   - Smart implementation - don't remove

### Code Style

- Vanilla JS (no frameworks)
- ES6 modules
- Explicit over implicit
- Comments explain *why*, not *what*
- Defensive checks at boundaries

---

## Communication Preferences

- **Direct feedback welcome** - Prefers honest technical assessment over validation
- **Show evidence** - Points to code/docs rather than asserting
- **Iterative revelation** - Will walk through features piece by piece if underestimated
- **Questions are tests** - Sometimes asks questions to see if the AI understands the system

---

## Project Context

### What miniCycle Is

- **Routine manager, NOT a todo app**
- Cycles persist and reset (tasks not deleted when complete)
- Cycle counts track consistency over time
- Gamification rewards routine completion
- .mcyc files enable sharing routines

### Hidden Complexity

The user-facing simplicity masks engineering depth:

| Feature | What It Actually Is |
|---------|---------------------|
| Recurring tasks | Full scheduling engine: 6 frequencies, DST-safe, hybrid optimization |
| Undo/Redo | Persistent per-cycle IndexedDB history with rollback |
| Drag & drop | Dual input (mouse/touch), Safari compat, race condition handling |
| Testing | 1,458 tests, Playwright CI, security/accessibility/stress tests |

### Business Context

- 100% free, no ads, no accounts
- Privacy-focused (local storage only)
- PWA with offline support
- Landing page with SEO structured data
- GitHub: sparkinCreations/miniCycle

---

## Notes for Future Sessions

1. **Read DEVELOPMENT_ASSISTANT_NOTES.md first** - Contains collaboration guidelines
2. **Don't underestimate the features** - Simple UX, sophisticated implementation
3. **Respect established patterns** - They exist for reasons learned through experience
4. **The 2-phase init is intentional** - Timeout safety was added Dec 2025, keep it
5. **Ask before changing architecture** - Developer knows the system deeply

---

## Session History

### December 9, 2025
- Fixed DI timing issues (gamesManager, onboardingManager)
- Added timeout safety to `waitForCore()` (10s) and `waitForApp()` (15s)
- Updated APPINIT_SYSTEM.md with timeout documentation
- Deep dive into recurring system, undo system, drag-drop, testing, product page
- Created this developer profile

---

*This document should be updated as new insights emerge from collaboration.*
