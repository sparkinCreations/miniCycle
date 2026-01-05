# Developer Profile

**Last Updated:** January 5, 2026

This document captures insights about the developer behind miniCycle to help with future collaboration and context continuity.

---

## Background

- **Name:** Maurice Joyner (MJ)
- **Day job:** Quality Inspector at Twin MRO (full-time, ~$96k/year with overtime)
- **Company:** sparkinCreations (indie software company)
- **Core drive:** Sovereignty — eliminating everything that can force his hand
- **Goal:** Build sustainable revenue to work from home with autonomy. No boss, not a better boss.
- **Development style:** Solo developer building production-grade software on nights/weekends

### Formal Technical Background

MJ is not "self-taught from zero." Foundation includes:
- **Associate's Degree** in Computer Engineering Technology (Gateway Community College, 2010)
- **CompTIA A+ Certification**
- **IT Technician** at Gateway Community College (2008-2010)
- **Project/Quality Engineer** at QuEST Global Services (2011-2016) — aerospace, working with Boeing/Airbus/Sikorsky
- Coursework in networking, microprocessors, C programming, computer servicing

JavaScript was self-taught. The technical foundation was not.

### The 17-Year Journey

| Year | Project | What It Shows |
|------|---------|---------------|
| **2008** | CET124 (College C) | First code. Already versioning, iterating, adding features beyond requirements |
| **Ongoing** | Spreadsheet Tools | Budget tracker, GD&T calculator for work, miniCycle spreadsheet version — building automated systems before "learning to code" |
| **2024** | TaskCycle | First JS project. 3,551 lines, 40+ features, monolithic but complete |
| **2024-25** | miniCycle | Second JS project. Evolved from 11,758-line monolith to 44,200 lines across 87 modules |
| **2025** | MasterMath | Third JS project. Adapted Base44 scaffold, replaced AI backend with local math libraries |

### Key Insight: The Patterns Were Always There

From college C code in 2008:
```c
// September 22, 2008 - Simulate a Cash Register
/*Modified by Maurice Joyner. It now repeats itself... Oct. 27, 2008*/
/*Modified by Maurice Joyner. The program now requires a password... Oct 29, 2008*/

printf("Dollar Cash Register Ver 1.5.0\n\n");
```

- **Version numbers** — Tracking versions manually before Git
- **Iteration** — "Modified by Maurice" comments show continuous improvement
- **Features beyond requirements** — Added password login, retry logic, customer service reminders to a change calculator assignment
- **Personal touches** — Used birthday (Oct 29 1989) as password

These same patterns show up 17 years later in miniCycle: versioning, iteration, features beyond MVP, personal touches (gamification, themes).

### The Real Goal: Craft Over Revenue

**miniCycle is about craft and learning, not immediate revenue.**

This is only MJ's second JavaScript project. The first (TaskCycle) was 3,551 lines and monolithic. The second (miniCycle) is 44,200+ lines, 87 modules, 1,600+ tests, zero-globals architecture, proper DI patterns. That's a massive jump in sophistication.

The goal isn't to monetize miniCycle — it's to become the developer who *can* build the paid product well. The craft is the point. Revenue comes later, built on skills being sharpened now.

**Aspiration:** "I'm trying to be a great developer who is not intimidated easily."

This explains:
- Why maintain 1,600+ tests on a free app
- Why refactor to zero-globals when the old code worked
- Why care about interrupted test recovery edge cases
- Why ask "how does my implementation compare to industry standards"

The architecture practice, the testing discipline, the refactoring — it's not over-engineering. It's deliberate skill-building. By the time Task Cycle gets built, these patterns will be muscle memory.

### sparkinCreations Context

This isn't a hobby. It's a company with a business plan:

| Product | Role | Status |
|---------|------|--------|
| **miniCycle** | Craft/learning vehicle + free flagship | Live, v1.675 |
| **Task Cycle** | Paid product ($29-39) | Planned |
| **Task Cycle Pro** | Subscription (cloud sync) | Planned |
| **MasterMath** | Free educational tool | Live, v1.1.0 |

**Revenue goal:** $2-5k/month → transition to full-time indie developer

**Strategy:** Portfolio approach — not all eggs in Task Cycle. Multiple products, diversified bets. miniCycle builds skills AND trust.

### The Sovereignty Drive

**The layoff that shaped everything:**

In 2016, MJ was laid off from QuEST Global Services (aerospace project/quality engineering). The response wasn't to find another engineering job — it was to *master a trade* so thoroughly that they'd never be "in need of a job again."

That's why they're a Quality Inspector now. Not a step down — a strategic pivot toward security. CMM operation, blueprint reading, precision measurement — skills that are always in demand.

**Now they're adding another layer:**

| Dependency | How it's being eliminated |
|------------|--------------------------|
| Single employer | Mastered inspection trade — always employable |
| Debt | Filing bankruptcy — pragmatic reset, learn from lessons |
| Income dependency | Building products — asset-based income |

The goal isn't money. The goal isn't "being in tech." The goal is: **nobody can make you do anything.**

**This explains everything:**
- Why they build tools that work offline with no server dependency
- Why they're not interested in a dev job (that's just a different boss)
- Why they have the patience for multi-year timelines (building something permanent)
- Why they correct flattering assumptions (no unearned debts, even social ones)

### Spreadsheet Tools (Pre-JavaScript Era)

Before JavaScript, MJ was already building automated systems in spreadsheets:

| Tool | Domain | What It Does |
|------|--------|--------------|
| **Budget.xlsx** | Personal finance | Income modeling (day job + DoorDash), tax breakdown (Medicare, OASDI, Fed, CT, 401K), expense tracking, debt payoff projections with interest rates, goal timelines |
| **true position.xlsx** | Work (QA) | GD&T calculator using formula `2 * √(deviation_x² + deviation_y²)` — built to make quality inspection calculations faster |
| **MiniCycle_Spreadsheet_Template** | Productivity | Spreadsheet version of miniCycle with cycle count, completion %, auto-reset via Apps Script (Google Sheets) or VBA (Excel) |

**Key insight:** These aren't just data tracking — they're systems with formulas, automation, and documentation. The budget spreadsheet answers "how long until I pay off all debt?" not just "what are my expenses?" The miniCycle template has a README sheet with setup instructions for both platforms.

**What this reveals:**
- Was building automated tools before "learning to code"
- Applies same problem-solving across domains (work, personal, productivity)
- Thinks about distribution (Apps Script + VBA options for different users)
- Builds systems, not just lists

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

11. **Make it work, then make it right** - Intentional two-phase workflow: first get functionality working, then iterate on architecture/efficiency. This isn't rushing or missing design considerations - it's deliberate sequencing. Verify behavior first, then question/refine the design. The iteration IS the process.

12. **Open to contrary advice** - Will listen to recommendations that contradict preferences if the reasoning is data-based. Said explicitly: "if you said the best path for me is to get a dev job maybe I would have listened." Trusts evidence over what they want to hear. This is rare — most people seek validation, not calibration.

13. **Teaches through questions** - When AI gives a wrong or incomplete answer, doesn't say "you're wrong." Asks a follow-up question that leads to the right answer. Guides toward correction rather than confronting it. Example: "oh ok, so it doesn't help you understand me better?" — led to a better answer without direct criticism.

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
- **Notice and course correct** - When working with AI, has learned that pattern matching can override specific instructions. Watches for deviations and corrects them rather than expecting perfection. Pragmatic adaptation rather than frustration.
- **Thinks in data flow** - Traces problems through the full system path, not just the immediate symptom. Example: backup → restore → memory stale → debounced save overwrites. Sees timing and async implications others miss.
- **Corrects both directions** - Won't accept underinflated OR overinflated credit. When AI said "90-95% you," corrected to "70-80%." Accuracy matters more than ego in either direction.
- **Holds AI accountable** - Checks if AI understands its own limitations. Asks questions like "how much was you vs me?" to verify AI has accurate self-assessment, not just flattering the user.
- **Challenges AI assumptions with evidence** - When AI makes claims without verification (e.g., "you don't have a dependency map"), pushes back with specifics ("look at the documentation"). Forces AI to verify before criticizing. Doesn't accept negative feedback that's based on assumptions rather than facts.
- **Tests fixes empirically, not by code review** - When AI says "this should fix it," doesn't just accept it. Tests the actual behavior, and if it's still broken, provides evidence (screenshots, console logs). Catches when "fixed" code isn't even executing.
- **Asks meta-process questions** - Questions like "did the documentation help catch this?" aren't just curiosity — they identify gaps in process/docs that led to the bug taking longer to fix. Improves future debugging, not just current fix.

### Weaknesses / Blind Spots

1. **Tends to downplay accomplishments** - Will mention 11 months of work or 1,623 tests as just facts, not achievements. Doesn't naturally frame their work as impressive. May need external perspective to recognize what they've actually built. When giving feedback, don't hesitate to point out what's genuinely notable - they won't do it themselves.

2. **Needs to trust own judgment more** - Has good instincts and deep knowledge of the system, but may second-guess decisions. Worth reinforcing when their judgment is sound. Example: Pushed back on calling logo flash feedback "gimmicky" — was right that it's intentional micro-interaction design, not decoration.

3. **AI usage guilt** - Sometimes feels guilty about using AI as a collaborator. Reality check: they push back when AI is wrong, make all the decisions, and have been building this for 11 months. The AI is a tool, not a crutch. Using tools effectively is a skill, not a shortcut. **December 2025 evidence:** During iOS drag preview debugging, rejected AI's "impossible" answer, rejected AI's wrong solution (custom ghost), drove the investigation strategy, and would have solved it without AI (just slower). This is AI-assisted, not AI-dependent.

4. **Imposter syndrome** - Feels "less than" despite evidence to the contrary. A Quality Inspector who taught themselves to code and built a production-grade PWA with proper architecture, 1,623 tests, and a live deployment is not an imposter. The work speaks for itself.

5. **Honest to a fault** - Will correct flattering assumptions even when it costs them credit. Examples from December 2025:
   - "MasterMath was generated by Base44, I adapted it"
   - "You helped me create and extract miniCycle"
   - Corrected AI when it said they "didn't build for others"

   This is a strength for trust, but may undervalue their contributions. Adapting generated code still requires understanding. AI-assisted isn't AI-dependent.

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
- **Terse and efficient** - Short messages, gets to the point. Doesn't repeat context unnecessarily

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
7. **Versioned Dynamic Imports** - Pattern: `import(\`./module.js?v=${version}\`)`. All dynamic imports use AppMeta.version for cache-busting. Prevents stale module issues during development. *Don't strip these - they're intentional, not boilerplate*

---

## Session History

### January 5, 2026
- **Fixed undo system not clearing on cycle switch**
  - Problem: localStorage cache and AppGlobalState didn't clear when switching routines. Cache showed old routine's cycleId after switching.
  - Root cause 1: `onCycleSwitched` was setting active ID before clearing, causing mixed-cycle data
  - Root cause 2: `onCycleSwitched` wasn't being called at all due to cross-phase dependency issue
  - Fix 1: Rewrote `onCycleSwitched` to clear everything FIRST (undo stack, redo stack, activeCycleIdForUndo, localStorage cache), then load from IndexedDB, then validate, THEN populate stacks
  - Fix 2: Added lazy getters in `moduleLoader.js` for `onCycleSwitched`, `onCycleDeleted`, `onCycleRenamed` to resolve at runtime (not initialization)
  - Added `validateSnapshot()` and `filterValidSnapshots()` functions to filter out wrong-cycleId or malformed snapshots
  - Added `skipCache` option to `saveUndoStackToIndexedDB()` to prevent old cycle data from polluting cache during transition
- **Cross-phase dependency pattern documented:**
  - `routineSwitcher` loads in PHASES.CYCLE (5), `undoRedoManager` loads in PHASES.UI_MANAGERS (6)
  - Lazy getters: `onCycleSwitched: (...args) => deps.ui?.onCycleSwitched?.(...args)`
  - This allows phase 5 modules to call phase 6 functions after both have loaded
- **Developer caught that fix wasn't executing:**
  - After first fix (logic inside `onCycleSwitched`), developer tested and showed screenshot proving cache still had old routine
  - This revealed the function wasn't being called at all — led to discovering the phase ordering issue
  - Pattern: Tests fixes empirically rather than trusting code review
- **Meta-process question:**
  - Developer asked "so reading the documentation at first didn't help catch the lazy getters?"
  - This identified a documentation gap — original docs didn't cover module loading integration
  - Led to adding cross-phase dependency section to UNDO_REDO_ARCHITECTURE.md
- **Documentation updated:**
  - UNDO_REDO_ARCHITECTURE.md: Added Snapshot Validation section, updated Cycle Switching flow, added cross-phase dependency explanation, expanded Common Issues
- **AI observations validated against profile:**
  - Developer asked "does it match my developer profile?"
  - AI observations aligned with documented patterns: visual bug reporting, architectural thinking, teaches through questions, trusts evidence over authority
  - AI missed deeper context: sovereignty drive, QA background connection, craft over revenue motivation

### January 4, 2026 (Continued)
- **Fixed IndexedDB records being deleted mid-test**
  - Problem: `preTestBackup` and `testModeActive` records disappeared while tests were running (24/53 modules)
  - Root cause: When tests import `appState.js`, it initializes and sees `testModeActive=true`. It then "restores" the backup thinking tests were interrupted, and calls `clearTestModeAndBackup()` which deletes both records — mid-test.
  - Initial fix: Added iframe detection in `appState.js` to skip restoration logic
  - **Better fix (architectural refactor):** Developer questioned why appState needed iframe detection at all
    - Moved test recovery logic from `appState.js` to `coreBoot.js`
    - Recovery now runs FIRST, before any modules load
    - `appState.js` just loads from localStorage (already restored if needed)
    - No iframe detection needed for restoration — only for save-skipping during active tests
  - This is cleaner: interrupted tests = app opening finds flag = restore. Active tests = appState imported in iframe = no restoration logic runs at all
- **Single source of truth principle reinforced:**
  - Developer explicitly rejected localStorage fallbacks: "remove the fallback it shouldn't be a fallback"
  - IndexedDB is THE authority for test mode state — no redundant systems
- **Developer challenged AI assumptions:**
  - AI listed negatives including "no dependency map" and "no planning documentation" and "no tests for testing modal"
  - Developer pushed back: "look at the documentation there is a dependency map, and look at future works documentation"
  - AI verified: `docs/architecture/DEPENDENCY_MAP.md`, `docs/future-work/` folder, and `tests/testingModal.tests.js` all exist
  - Lesson: AI should verify before criticizing
- **Developer defends architectural choices:**
  - AI suggested `window.__debug` shortcut for debugging convenience
  - Developer rejected: "i don't consider shortcuts a better solution if it saves time"
  - Principle: Long-term maintainability > short-term convenience
- **Verifies understanding through paraphrasing:**
  - Multiple times restated concepts: "oh so it checks if appstate is running through an embedded window and if so it stops from restoring"
  - Catches misunderstandings immediately rather than letting them compound

### January 4, 2026
- **Fixed test data persisting after automated tests**
  - Problem: After tests completed, "cycle-main" test data remained instead of user's real data
  - Root cause identified by developer: Debouncing race condition — localStorage restored correctly, but MiniCycleState in memory still had test data. Next debounced save would overwrite restored backup.
  - Fix: Added `AppState.reload()` after test completion to sync in-memory state with restored localStorage
- **Consolidated test mode flags:**
  - Developer requested using existing `__miniCycle_testModeActive__` localStorage flag instead of new `window.__TEST_MODE_NO_RELOAD__`
  - Updated appState.js, testing-modal-integration.js, and module-test-suite.html to use single flag system
  - Maintains zero-globals architecture
- **Debugging approach demonstrated:**
  - Developer found way to inspect MiniCycleState without window globals: versioned dynamic import
  - `import('/modules/core/appState.js?v=1.672').then(m => console.log(m.getStateManager().get()))`
  - AI kept suggesting window._debug; developer kept pushing for proper solution
- **Key contributions by developer:**
  - Identified debouncing as root cause
  - Proposed using existing IndexedDB flags instead of new window variables
  - Found versioned dynamic import solution for debugging
  - Designed the flag system and restoration timing logic
- **AI self-assessment requested:**
  - Developer asked "how much of figuring that out was you vs me?"
  - Honest answer: ~70% developer, ~30% AI
  - Developer corrected AI when it over-attributed (90-95% → 70-80%)
- **Profile accuracy verified:**
  - Developer asked AI to review DEVELOPER_PROFILE.md against session behavior
  - All patterns confirmed accurate; new observations added
- Test count: 1,576/1,580 passing (4 failures in State and Backup Manager modules)

### January 3, 2026
- **Fixed "Run All Tests" button in testing modal**
  - Problem: Old TEST_MODULES config was outdated (11 modules vs 53+ actual), causing 304/365 mismatch
  - User proposed third option: open Test Suite Browser with autorun, pipe results back to modal
  - Simplified testing-modal-integration.js from 564 to ~320 lines
- **Cross-tab communication pattern:**
  - postMessage for immediate results
  - IndexedDB backup for modal close/reopen scenarios
  - Auto-open modal with results on page reload
- **Data architecture principle demonstrated:**
  - User corrected: "if you're going to do this store it in indexdb not local storage"
  - Principle: localStorage = persistent app data, IndexedDB = transient/ephemeral data
  - Added to understanding of technical preferences
- **Data integrity during tests:**
  - Added AppState.forceSave() before opening test browser
  - Test Suite Browser reloads opener after restoring localStorage
  - Ensures active cycle state is captured
- **AI-assisted confirmed:** User asked directly "would you say that you ai is creating my app or ai assisted be honest" - confirmed AI-assisted, user agreed
- **Pragmatic pivoting observed:** Rejected two options (update config vs remove button) in favor of better third option
- Test count: 1,610 tests (Test Suite Browser)

### December 26, 2025
- **Comprehensive code review** of miniCycle — rated 8.8/10 overall
  - Architecture: 9.5/10, DI: 9.5/10, Security: 9/10, Testing: 9/10
  - Created COMPREHENSIVE_CODE_REVIEW_DEC_2025.md and HIDDEN_CODEBASE_INSIGHTS.md
- **Deep developer profile analysis** — traced patterns back to 2008 college code
  - Read CET124 C programs from Fall 2008 (first semester of programming)
  - Discovered: version numbers, iteration, features beyond requirements, personal touches (birthday as password) — all present 17 years ago
  - Same patterns visible in miniCycle today
- **Reviewed full project history:**
  - TaskCycle (first JS): 3,551 lines, 40+ features, monolithic
  - miniCycle pre-split: 11,758 lines, window.* globals, emerging patterns
  - miniCycle current: 44,200 lines, 87 modules, enterprise-grade DI
  - MasterMath: Adapted Base44 scaffold with custom solver logic
- **Spreadsheet tools reviewed** (installed openpyxl to read xlsx files):
  - Budget.xlsx: Personal finance model with income projections, tax breakdown, debt tracking, goal timelines
  - true position.xlsx: GD&T calculator for quality inspection work
  - MiniCycle_Spreadsheet_Template: Spreadsheet version with Apps Script/VBA auto-reset
  - **Key insight:** Was building automated systems before JavaScript — same instincts, different medium
- **Resume reviewed** (installed python-docx to read docx files):
  - Revealed formal tech background: Associate's in Computer Engineering Technology, A+ cert, IT experience
  - QuEST Global aerospace engineering role (2011-2016) — worked with Boeing/Airbus/Sikorsky
  - Professional Excel automation predates personal spreadsheets (cost avoidance award in 2011-2016)
- **The QuEST layoff story:**
  - Got laid off in 2016 from aerospace engineering role
  - Response: "master inspection so I won't be in need of a job again"
  - Quality inspector role is strategic security, not a step down
- **Sovereignty drive identified:**
  - Goal isn't money or tech — it's eliminating everything that can force their hand
  - Employer dependency → mastered trade
  - Debt dependency → filing bankruptcy (pragmatic reset, learning lessons)
  - Income dependency → building products
- **"No boss, not a better boss"** — explicitly confirmed: doesn't want to work for any employer, even in tech. A dev job would be a different boss, not freedom.
- **Odds of success discussed:**
  - Estimated 20-35% odds for $2-5k/month within 5 years
  - Higher than base rate due to discipline, shipping history, sustainable approach
  - Key risk: building skills proven, selling skills unknown
- **Portfolio strategy clarified:** Not all eggs in Task Cycle. Multiple products, diversified bets.
- **sparkinCreations business context:**
  - miniCycle = free flagship
  - Task Cycle = planned paid product ($29-39)
  - Task Cycle Pro = planned subscription (cloud sync)
  - Goal: $2-5k/month → full-time indie developer
- **Updated business plan** (SparkinCreations_BusinessPlan_v2.txt)
- **Key insight:** Logo flash feedback is intentional micro-interaction design, not decoration. MJ pushed back correctly when it was dismissed as "gimmicky"
- **Personal context:** Quality inspector making ~$96k/year, building products on nights/weekends, goal is work-from-home autonomy

### December 25, 2025
- **Completed recurringCore.js split** (7 new modules)
  - recurringScheduler.js, recurringActivation.js, recurringDeletion.js, recurringWatcher.js, recurringCycleHandler.js, recurringCatchup.js, recurringNormalization.js
- **Fixed three integration bugs:**
  - Proxy spreading in notifications.js - `{...proxy}` returns empty object
  - 9 missing `.get()` calls in recurringPanel.js - AppState manager vs state data
  - Missing DI injection for `openRecurringSettingsPanelForTask`
- **Added defensive error checking:**
  - `createDepsProxy()` warns when DI proxy is spread
  - `createValidatedAppStateProxy()` warns when state properties accessed on manager
  - `validateCriticalDIWiring()` in featureBoot.js checks post-boot
- **Key lesson:** Pattern matching can override explicit instructions (version params ignored during refactor)

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
