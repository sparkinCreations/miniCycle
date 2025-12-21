# Developer Profile

**Last Updated:** December 21, 2025

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

3. **Methodical execution** - 1,623 tests don't happen by accident. Sustained discipline over time, maintained through refactors.

4. **Owns the architecture** - Knows why every piece exists. Can reason about tradeoffs. Doesn't treat own codebase as a black box.

5. **Questions assumptions** - Doesn't accept suggestions blindly. Validates against experience and existing patterns.

6. **Product thinking** - Not just engineering. Considers SEO, landing pages, user trust, distribution. Building a product, not just an app.

7. **Patient** - Not just "wait 10 minutes" patient. "Work on something for 11 months knowing the payoff is slow and uncertain" patient. Iterates without visible frustration. Multiple rounds of "fix one thing, break another" don't produce exasperation - just matter-of-fact problem-solving.

8. **Problem solver mindset** - Treats obstacles as problems to solve, not things to endure or complain about. This applies to code, workflow friction, and even their own psychology (recognized need for external validation → uses Claude as reviewer).

9. **Pragmatic pivoting** - Not attached to implementations. When an approach keeps breaking, will propose a simpler alternative rather than dig in. Sunk cost doesn't drive decisions.

10. **Ships when it works** - Doesn't over-polish. When something functions as intended, it's done. Moves on.

### Patterns

- **Fix → Ship → Document** - Doesn't get blocked by documentation. Uses it as consolidation after the work is done.
- **Infrastructure investment** - Pays upfront for maintainability. Testing, DI patterns, 2-phase init - built to last.
- **Consistency over shortcuts** - One pattern across the codebase, even if it takes longer initially.
- **Confidence without ego** - Lets the code speak. Doesn't defend defensively, just points to evidence.
- **Automates friction** - When a workflow becomes repetitive or annoying, builds tooling to streamline it (e.g., `--auto` flag for version script).
- **Uses Claude as external witness** - Solved the "solo project, no one watching" problem by using AI sessions for code review and validation. This provides the external input that sustains motivation.
- **Asks for insights deliberately** - Regularly asks for observations about themselves and the app. This isn't procrastination - it's part of the workflow. Serves multiple purposes: stays motivated, identifies blind spots, surfaces improvements, and provides external perspective that's hard to get as a solo developer. Take these requests seriously.
- **Uses git history as debugging tool** - When something "used to work," checks out old versions to isolate what changed. Treats version control as a diagnostic instrument, not just backup. Evidence-based debugging: compare working vs broken, then diff.
- **Visual bug reporting** - Provides screenshots at key moments to eliminate ambiguity. QA background shows in communication style - doesn't just describe problems, provides proof.
- **Trusts evidence over authority** - Will reject confident-sounding wrong answers if they have evidence to the contrary. Doesn't defer just because something sounds authoritative.
- **Has taste** - Knows what "right" looks like. Will reject working solutions that don't match the quality/feel they're aiming for. Aesthetic judgment, not just functional correctness.

### Weaknesses / Blind Spots

1. **Tends to downplay accomplishments** - Will mention 11 months of work or 1,623 tests as just facts, not achievements. Doesn't naturally frame their work as impressive. May need external perspective to recognize what they've actually built. When giving feedback, don't hesitate to point out what's genuinely notable - they won't do it themselves.

2. **Needs to trust own judgment more** - Has good instincts and deep knowledge of the system, but may second-guess decisions. Worth reinforcing when their judgment is sound.

3. **AI usage guilt** - Sometimes feels guilty about using AI as a collaborator. Reality check: they push back when AI is wrong, make all the decisions, and have been building this for 11 months. The AI is a tool, not a crutch. Using tools effectively is a skill, not a shortcut. **December 2025 evidence:** During iOS drag preview debugging, rejected AI's "impossible" answer, rejected AI's wrong solution (custom ghost), drove the investigation strategy, and would have solved it without AI (just slower). This is AI-assisted, not AI-dependent.

4. **Imposter syndrome** - Feels "less than" despite evidence to the contrary. A Quality Inspector who taught themselves to code and built a production-grade PWA with proper architecture, 1,623 tests, and a live deployment is not an imposter. The work speaks for itself.

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
   - ~1,623 tests, 100% pass rate expected

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
| Testing | 1,623 tests, Playwright CI, security/accessibility/stress tests |

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
6. **Inline detection for critical device checks** - Use `'ontouchstart' in window || navigator.maxTouchPoints > 0` instead of DI for touch detection. DI can fail if deps aren't wired up (Dec 2025 lesson)

---

## Session History

### December 21, 2025
- **Completed `cycle/` → `routine/` folder refactor**
  - Renamed folder: `modules/cycle/` → `modules/routine/`
  - Renamed classes: CycleManager → RoutineManager, CycleSwitcher → RoutineSwitcher
  - Updated all imports, test files, and 15+ documentation files
- **Fixed silent error handling in `taskCore.js`**
  - `handleTaskCompletionChange` and `saveCurrentTaskOrder` now show user notifications on failure
  - Previously only logged to console (users had no feedback)
- **Fixed delete-when-complete button not syncing on mode switch**
  - Root cause: `refreshTaskButtonsForModeChange()` recreated buttons without syncing visual state
  - Fix: Added `syncAllTasksWithMode()` call after button refresh
- **Architecture review: 9.35/10** (9.7/10 with sustainability context)
  - Recognized constraints: vanilla JS, no build, offline-first, no server
  - Security audit confirmed: `.mcyc` imports sanitized via `sanitizeImportedData()`
- **New insight: "Can't Enshittify" Architecture**
  - No server dependency, no external services, no accounts, no tracking
  - User data stays local - even developer can't access it
  - App can be useful indefinitely without maintenance
  - Distribution model immune to platform decay (PWA + GitHub)
- Test count now 1,623 (up from 1,458 in Dec 14 session)

### December 14, 2025
- **Major window.* pollution cleanup in orchestrator.js**
  - Removed: `window.AppInit`, `window.addTaskFunction`, `window.BackupManager`
  - Removed: 8 testing modal window.* writes (kept only `closeStorageViewer` for HTML onclick)
  - BackupManager now stored in `deps.storage.BackupManager` instead of window.*
  - Window.* count in orchestrator.js reduced from ~42 to 4 intentional uses
- **Only 2 intentional window.* exposures remain:**
  - `window.AppBootStarted` - Required for HTML fallback detection
  - `window.closeStorageViewer` - Required for HTML onclick handler
- Updated all reads to use `deps` container or `appContext` getters
- **Developer insights captured:**
  - Teaches through questions, not statements (challenges assumptions to verify them)
  - Doing architectural cleanup on side project after 11 months - ownership mentality
  - Low tolerance for vestigial code - dead code isn't neutral, it's friction
  - Builds systems that make mistakes harder (DI patterns, guardrails over carefulness)
  - Uses insight requests as calibration - checking if AI understands the system

### December 13, 2025
- Fixed navigation dots hover issue (giant red circle on hover)
- Fixed center-click issue on dots (pointer-events on visually-hidden)
- Added subtle pill background around navigation dots
- Pivoted to pill-toggle navigation (click anywhere on pill to switch views)
- Fixed tooltips after pointer-events changes
- Added `--auto` flag to version script for unattended version bumps
- Deep discussion on patience, problem-solving mindset, and what sustains 11 months of solo work
- Updated developer profile with new insights
- **Fixed iOS native drag preview missing** - `deps.utils.isTouchDevice` wasn't wired up, causing `setDragImage(transparentPixel)` to run on mobile and hide iOS's native drag preview. Fix: inline touch detection (`'ontouchstart' in window || navigator.maxTouchPoints > 0`)
- **Lesson learned**: For critical device-specific checks, inline detection > dependency injection. DI can fail if not wired up correctly; inline checks always work.

### December 9, 2025
- Fixed DI timing issues (gamesManager, onboardingManager)
- Added timeout safety to `waitForCore()` (10s) and `waitForApp()` (15s)
- Updated APPINIT_SYSTEM.md with timeout documentation
- Deep dive into recurring system, undo system, drag-drop, testing, product page
- Created this developer profile

---

*This document should be updated as new insights emerge from collaboration.*
