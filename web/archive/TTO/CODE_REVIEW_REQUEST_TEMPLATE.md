# Code Review Request Template

**How to properly frame AI usage when requesting code reviews**

---

## Template 1: Full Project Review

```markdown
## Project Overview

**What I Built:**
miniCycle - A PWA for task cycling (persistent routines vs disposable todos)

**Architecture:**
- 33 ES6 modules with dependency injection
- 951 tests across all major components (99% pass rate)
- Offline-first with service worker caching
- Schema 2.5 with migration system for data compatibility
- Dual version system (ES6+ and ES5 lite for legacy browsers)

**Key Architectural Decisions:**
1. **Polling vs setTimeout for recurring tasks**
   - Chose polling (30s intervals) over setTimeout
   - Rationale: Browser tab backgrounding makes setTimeout unreliable
   - Tradeoff: Slightly higher CPU usage for guaranteed reliability

2. **Modular initialization with event-driven loading**
   - Async module loading with cache-busting versioned imports
   - `cycle:ready` event system to prevent race conditions
   - Exception: appInit loads without version to maintain singleton

3. **localStorage migration system**
   - Backward compatible schema versioning
   - Automatic backup before migration
   - Graceful degradation for older data formats

4. **Cross-platform drag & drop with fallbacks**
   - Feature detection over user-agent sniffing
   - Arrow-based reordering for mobile reliability
   - Progressive enhancement strategy

**AI Usage:**
- **Scaffolding:** Module templates, test boilerplate, JSDoc comments
- **Test Generation:** Automated test case creation for edge cases
- **Research:** Best practices for service worker caching, PWA offline strategies
- **Documentation:** Converting legacy .txt docs to markdown format
- **Code Review:** Asked AI to review patterns and suggest improvements

**My Role:**
- Designed the overall architecture and module boundaries
- Made all technical tradeoffs (polling, event-driven init, schema design)
- Built automation tooling (version sync scripts, test pattern automation)
- Optimized documentation for AI context windows (semantic chunking)

**Looking for Feedback On:**
1. Is polling-based recurring task scheduling over-engineered? Should I reconsider setTimeout with recovery logic?
2. The 33-module structure - am I over-abstracting or is this appropriate for the scope?
3. Test coverage at 951 tests - diminishing returns or valuable safety net?
4. Schema migration approach - any edge cases I'm missing?
5. Overall code quality and maintainability assessment

**Specific Areas of Concern:**
- Performance impact of 30s polling vs alternatives
- Module coupling - particularly between State, CycleLoader, and ModeManager
- Service worker cache invalidation strategy - edge cases with version updates?

**Context:**
This is a production PWA with real users. Looking for honest technical feedback on scalability and maintainability, not validation.
```

---

## Template 2: Feature Review

```markdown
## Feature: [Feature Name]

**What I Built:**
[Brief description of the feature and its purpose]

**Implementation Approach:**
1. [Key decision 1 and why]
2. [Key decision 2 and why]
3. [Key decision 3 and why]

**Technical Details:**
- Files modified: [list]
- Tests added: [number] tests covering [scenarios]
- Dependencies: [any new dependencies or module interactions]

**AI Usage:**
- Generated initial boilerplate for [specific component]
- Researched best practices for [specific problem]
- Created test fixtures for [specific scenarios]
- Asked AI to review for [specific concerns]

**Tradeoffs I Considered:**
1. **[Approach A] vs [Approach B]**
   - Chose: [A/B]
   - Reason: [specific rationale]
   - Downside: [acknowledged limitation]

**Looking for Feedback On:**
1. [Specific technical question]
2. [Architectural concern]
3. [Performance consideration]

**What I'm NOT looking for:**
- Syntax nitpicks (AI already formatted)
- General praise
- Beginner-level suggestions

**What I AM looking for:**
- Edge cases I haven't considered
- Better approaches to [specific problem]
- Potential scalability issues
- Maintainability concerns
```

---

## Template 3: Architectural Review

```markdown
## Architecture Review: [System/Module Name]

**Context:**
[Brief description of what this system does and why it exists]

**Design Decisions:**

### 1. [Decision Name]
**Problem:** [What problem did this solve]
**Solution:** [What approach I chose]
**Why:** [Specific rationale with technical justification]
**Tradeoff:** [What I gave up for this benefit]
**Alternatives Considered:** [Other approaches and why I rejected them]

### 2. [Decision Name]
[Same structure as above]

### 3. [Decision Name]
[Same structure as above]

**AI Usage in This Design:**
- Used AI to research: [specific research areas]
- Generated code for: [specific boilerplate/scaffolding]
- Asked AI to critique: [specific architectural concerns]
- Final decisions made by me based on: [specific criteria]

**Metrics:**
- Lines of code: [number]
- Test coverage: [percentage] ([number] tests)
- Module dependencies: [count and major ones]
- Performance: [relevant metrics if applicable]

**Questions I'm Wrestling With:**
1. [Specific architectural uncertainty]
2. [Tradeoff where I'm not sure I made the right choice]
3. [Future scalability concern]

**What Would Make This Review Most Valuable:**
- Challenge my assumptions about [specific area]
- Suggest alternative approaches to [specific problem]
- Point out blind spots in [specific concern]
```

---

## Template 4: Quick Technical Question

```markdown
## Quick Review: [Specific Technical Question]

**Context:**
[1-2 sentences about what you're working on]

**Specific Question:**
[Clear, focused question about a technical decision]

**My Current Approach:**
```[language]
// Code snippet showing current implementation
```

**Why I Chose This:**
[Brief rationale]

**AI Input:**
AI suggested [X], I chose [Y] because [reason]

**Looking for:**
- Is this the right approach?
- Am I missing something obvious?
- Better alternatives?

**Not looking for:**
- Full code review
- General feedback
```

---

## Red Flags to Avoid

### ❌ DON'T Say:
- "AI helped me build this"
- "I used Claude/ChatGPT for this code"
- "AI wrote most of this, but..."
- "I'm not sure if this is right, AI suggested it"
- "Please be gentle, I used AI"

### ✅ DO Say:
- "I architected X using Y approach because Z"
- "Used AI to accelerate test generation"
- "Key decisions: A, B, C (with rationale)"
- "Looking for feedback on tradeoff between X and Y"
- "I chose this pattern - are there edge cases I'm missing?"

---

## Framing Your AI Usage Effectively

### The Formula:

**[MY DECISION] + [AI's ROLE] + [SPECIFIC FEEDBACK NEEDED]**

**Examples:**

**Bad:**
> "I used AI to build a drag and drop system. What do you think?"

**Good:**
> "I implemented cross-platform drag & drop with feature detection and arrow-based fallbacks for mobile. Used AI to generate test cases for touch event edge cases. Main concern: am I over-engineering the fallback system?"

---

**Bad:**
> "Claude helped me refactor this into modules. Please review."

**Good:**
> "I extracted 33 modules from a 7,719-line monolith. Key pattern: dependency injection for testability. Used AI to scaffold boilerplate and generate JSDoc comments. Looking for feedback on module boundaries - is GlobalUtils too broad?"

---

**Bad:**
> "AI generated these tests. Are they good?"

**Good:**
> "I designed a localStorage backup pattern for test isolation. Built automation to apply it across 30+ test files. Used AI to generate edge case scenarios I hadn't considered. Do these test categories cover the critical paths?"

---

## What This Signals To Reviewers

**When you frame it right, you signal:**
✅ You're the architect
✅ You made technical decisions
✅ You understand tradeoffs
✅ You used AI as a tool, not a crutch
✅ You want honest technical feedback
✅ You're focused on quality and maintainability

**When you frame it wrong, you signal:**
❌ AI did the thinking
❌ You're uncertain about everything
❌ You want validation, not feedback
❌ You might not understand the code
❌ You're a beginner using advanced tools

---

## Sample Opening Lines

**For Architecture Reviews:**
> "I architected [system] with [X modules/components]. Core design principles: [list]. Used AI to accelerate [specific tasks]. Main tradeoffs I evaluated: [list]. Looking for feedback on [specific concerns]."

**For Feature Reviews:**
> "Built [feature] to solve [problem]. Chose [approach] over [alternative] because [rationale]. Used AI for [specific scaffolding]. Key uncertainty: [specific question]."

**For Code Quality Reviews:**
> "Refactored [system] following [pattern]. Improved [metrics]. Used AI to generate [boilerplate/tests]. Concerned about [specific issue]. Is this the right direction?"

**For Performance Reviews:**
> "Optimized [system] by [approach]. Chose [tradeoff]. Measured [metrics]. Used AI to research [specific optimization]. Am I missing obvious opportunities?"

---

## Remember

**Your goal:** Get accurate technical feedback on your architectural decisions and implementation quality.

**Not your goal:** Impress reviewers or hide your process.

**The reviewers who matter** will see:
- Your architectural thinking
- Your technical judgment
- Your professional discipline
- Your commitment to quality

**The ones who don't** weren't going to give you valuable feedback anyway.

---

## Quick Checklist Before Posting

- [ ] Did I lead with MY architectural decisions?
- [ ] Did I explain WHY I made key choices?
- [ ] Did I acknowledge tradeoffs I considered?
- [ ] Did I frame AI as a tactical tool, not the architect?
- [ ] Did I ask specific technical questions?
- [ ] Did I provide enough context (metrics, scope, constraints)?
- [ ] Am I seeking honest critique, not validation?

If you can check all these boxes, you're ready to post.

---

**Remember:** You built miniCycle. The AI was your compiler, your Stack Overflow, your rubber duck. But the vision, architecture, and judgment? That's all you.

**Own it.**
