# miniCycle Roadmap

> **Future plans for miniCycle - The Free Tier**
>
> **For current metrics, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Last verified:** Nov 6 2026

> **Status:** Partly historical. The dated releases under *Upcoming Updates*
> (v1.360 → v2.0, Q1–Q4 2026) were planned in Dec 2025 under the old numbering; the
> app reached v2.0 on Feb 24 2026 and has released continuously since (`CHANGELOG.md`),
> so those headings no longer name real releases. Items confirmed shipped are marked
> ✅ with where they live; unmarked items are unverified, not necessarily open. Tier
> names, prices and vote counts are owner statements nothing in the repo can check.

---

## Vision

**miniCycle** is the **forever-free gateway** to the cycling methodology. It introduces users to task cycling, habit formation, and systematic progress - establishing the foundation for upgrading to professional tiers when needed.

### Three-Tier Ecosystem

miniCycle is **Tier 1** of SparkinCreations' product ecosystem:

1. **miniCycle** (Free) - Personal habit building & cycling introduction
2. **Task Cycle** ($25 one-time) - Professional workflows & advanced features
3. **Task Cycle Pro** ($10-15/month) - Team collaboration & cloud sync

**This roadmap covers miniCycle only.** Features like cloud sync, team collaboration, and advanced professional tools will be in Task Cycle/Pro.

---

## What miniCycle Will Always Be

### Core Principles (Never Changing)

✅ **100% Free** - No premium features, no paywalls
✅ **Offline-First** - Works without internet, no servers required
✅ **No Accounts** - No registration, no authentication
✅ **Privacy-First** - All data stored locally
✅ **Source-available** - Code is public to view and audit (the repo `LICENSE` is proprietary, view-only — not an open-source licence)
✅ **Personal Use** - Focused on individual habit building

**miniCycle's role:** Introduce cycling methodology to broad audience and serve as gateway to professional tiers.

---

## What Will NOT Be In miniCycle

### Features Reserved for Task Cycle/Pro

❌ **Cloud Sync** - Task Cycle Pro only
❌ **Team Collaboration** - Task Cycle Pro only
❌ **Multi-user Features** - Task Cycle Pro only
❌ **Advanced Analytics** - Task Cycle only
❌ **Task Comments** - Task Cycle only
❌ **Multiple Choice Tasks** - Task Cycle only
❌ **True/False Tasks** - Task Cycle only
❌ **Advanced Export Formats** - Task Cycle only
❌ **AI Features** - Task Cycle Pro only
❌ **API Access** - Task Cycle Pro only

**These features exist in paid tiers to support continued development.**

---

## Current Status ✅

> **For current version and metrics, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Core Features Complete:**

- ✅ Modularization Complete (DI-wired ES modules — counts in [PROJECT_STATS.md](../PROJECT_STATS.md))
- ✅ Playwright browser suite + CI validation gates (test counts and pass rate in [PROJECT_STATS.md](../PROJECT_STATS.md))
- ✅ Task Options Customizer (per-routine button visibility)
- ✅ Schema 2.6 (shipped v2.573, Sep 2026; 2.5 data is migrated once at boot)
- ✅ PWA with offline boot (pinned by `npm run test:sw`)
- ✅ Recurring Tasks System
- ✅ Undo/Redo (`LIMITS.UNDO_STACK` levels per routine)
- ✅ Drag & Drop System
- ✅ Vocabulary themes as milestone rewards (`MILESTONES.TIERS`); colours are Personalization presets
- ✅ Completed Tasks Dropdown
- ✅ Quick Access Buttons (personalization 🖌️, dark mode 🌓)
- ✅ Comprehensive Documentation

**miniCycle is feature-complete for personal habit building.**

---

## Upcoming Updates

> Planned Dec 2025 — see the *Status* note at the top. These version numbers were
> overtaken (v2.0 shipped Feb 24 2026); generic items (bug fixes, performance,
> docs) are ongoing rather than done or open.

### v1.360 - Q1 2026

**Focus: Polish & Refinement**

- [ ] Performance optimizations
- [ ] Mobile experience improvements
- [ ] Accessibility enhancements towards WCAG 2.2 Level AA, the goal the accessibility statement names (not a conformance claim) — *partly: `npm run test:a11y` and `npm run test:contrast` gate keyboard operability, names and serious contrast violations. AAA is not a goal*
- [x] Additional themes (achievement unlocks) — ✅ Habit Tracker, Fitness, Scholar, Cleaning (`MILESTONES.TIERS` in `core/constants.js`)
- [ ] Bug fixes and stability
- [ ] Documentation improvements
- [x] Tutorial improvements — ✅ guided tour (`ui/guidedTourManager.js`)

**No new major features - refinement phase.**

---

### v1.400 - Q2 2026

**Focus: User Experience**

- [x] Onboarding improvements — ✅ `ui/onboardingManager.js`
- [x] Better first-time user experience — ✅ first-run choice screen (inline in `miniCycle.html`) and the Welcome Screen (`ui/titleScreen.js`)
- [x] Help system enhancements — ✅ help window (`ui/helpWindowManager.js`)
- [ ] Visual polish and animations
- [ ] Sound effects (optional)
- [x] More achievement-based themes — ✅ see v1.360 above
- [ ] Performance dashboard (local stats only)

**Estimated Release:** June 2026

---

### v1.500 - Q3 2026

**Focus: Maintenance & Stability**

- [ ] Browser compatibility updates
- [ ] Performance optimizations
- [ ] Security hardening
- [ ] Code quality improvements
- [ ] Test coverage expansion
- [ ] Documentation updates
- [ ] Bug fixes

**Estimated Release:** September 2026

---

### v2.0 - Q4 2026

**Focus: Long-Term Stability**

- [ ] Architecture refinements
- [ ] Modernize dependencies
- [ ] Enhanced PWA features
- [ ] Better offline experience
- [ ] Improved data portability
- [ ] Legacy cleanup
- [ ] Performance improvements

**Estimated Release:** December 2026

**After v2.0:** miniCycle enters maintenance mode with bug fixes and compatibility updates only.

---

## Feature Requests (Under Consideration)

### High Priority (May Add)

- [x] **Task Options Customizer** - Per-routine button visibility customization — ✅ shipped (`ui/taskOptionsCustomizer.js`; [archived plan](../archive/TASK_OPTIONS_CUSTOMIZER_PLAN.md))
- [ ] Subtasks/checklist items (within tasks)
- [ ] Task dependencies (simple)
- [ ] More theme options
- [ ] Keyboard shortcuts expansion
- [ ] Print-friendly view
- [ ] CSV export (basic)
- [ ] Habit tracking charts (local only)
- [ ] Widget support (PWA)

### Medium Priority (Maybe)

- [ ] Tags/labels for tasks
- [ ] Task templates
- [ ] Batch operations (select multiple)
- [ ] Quick add shortcuts
- [ ] Customizable task fields
- [ ] Time tracking (simple)
- [ ] Pomodoro timer

### Low Priority (Unlikely)

- [ ] Custom CSS themes
- [x] Plugin system (basic) — ✅ exists as a developer API (`modules/other/basicPluginSystem.js`), no user-facing plugin UI
- [ ] Voice commands
- [ ] Calendar view
- [x] Browser extension — ✅ Chrome extension, lite popup + full app in the side panel (repo-root `chrome/`; side panel since v2.244)

**Note:** These are being considered but not guaranteed. miniCycle remains focused on core habit-building features.

---

## What Users Are Asking For

### Most Requested Features

1. **Cloud Sync** - 47 votes → **Go to Task Cycle Pro**
2. **Team Collaboration** - 38 votes → **Go to Task Cycle Pro**
3. **Advanced Analytics** - 28 votes → **Go to Task Cycle**
4. **Task Comments** - 24 votes → **Go to Task Cycle**
5. **Subtasks** - 32 votes → **Considering for miniCycle**
6. **Tags/Labels** - 21 votes → **Considering for miniCycle**
7. **Calendar Integration** - 19 votes → **Not planned for miniCycle**
8. **Multiple Choice Tasks** - 16 votes → **Go to Task Cycle**
9. **AI Features** - 14 votes → **Go to Task Cycle Pro**
10. **Custom Fields** - 12 votes → **Go to Task Cycle**

**When to upgrade:**
- Need cloud sync? → **Task Cycle Pro**
- Need team features? → **Task Cycle Pro**
- Need professional workflows? → **Task Cycle** ($25 one-time)
- Just building habits? → **Stay on miniCycle** (free forever)

---

## Development Philosophy

### For miniCycle

**Principles:**

1. **Keep it simple** - Core habit-building features only
2. **Keep it free** - No paywalls or premium features
3. **Keep it offline** - No server dependencies
4. **Keep it private** - No data collection
5. **Keep it small** - Fast, lightweight, efficient

**Why these limits?**

miniCycle serves as:
- Introduction to cycling methodology
- Gateway to professional tiers
- Always-free option for personal use
- Reference implementation people can read (source-available, see `LICENSE`)

**Complex features live in Task Cycle/Pro** where they can be properly supported and funded.

---

## Maintenance Commitment

### Long-Term Support

**What we promise:**

- ✅ Security updates (indefinitely)
- ✅ Bug fixes (indefinitely)
- ✅ Browser compatibility (as browsers evolve)
- ✅ Documentation (keep current)
- ✅ Source viewable (proprietary view-only `LICENSE`)

**What changes:**

- New features slow down after v2.0
- Focus shifts to stability
- More "feature complete, now refining"

**miniCycle will never:**

- Become paid
- Add paywalls
- Require accounts
- Collect data
- Shut down

---

## Upgrade Path

### When to Consider Task Cycle

**You might need Task Cycle ($25) if:**

- ✅ Using miniCycle professionally
- ✅ Need task comments/notes
- ✅ Need multiple choice tasks
- ✅ Need advanced statistics
- ✅ Need professional export formats
- ✅ Need compliance tracking
- ✅ Want to support development

**Task Cycle includes:**
- All miniCycle features
- Professional workflow tools
- Advanced task types
- Enhanced analytics
- One-time payment (no subscription)
- Still offline-first

### When to Consider Task Cycle Pro

**You might need Pro ($10-15/month) if:**

- ✅ Working with a team
- ✅ Need cloud sync
- ✅ Need collaboration features
- ✅ Need AI workflow templates
- ✅ Need team administration
- ✅ Need shared reporting

**Task Cycle Pro includes:**
- All Task Cycle features
- Cloud sync across devices
- Team collaboration
- AI-generated workflows
- Advanced team features
- Monthly subscription

---

## Community Involvement

### How to Influence miniCycle

**What we'll consider:**

- Features that serve personal habit building
- Improvements to core experience
- Accessibility enhancements
- Performance optimizations
- Bug reports

**What we won't consider:**

- Features requiring servers/cloud
- Team/collaboration features
- Complex professional workflows
- Features that bloat the app

**How to request:**

1. Check if it fits miniCycle's scope (personal, offline, simple)
2. If yes → GitHub Discussion
3. If no → Consider Task Cycle/Pro

---

## Technical Roadmap

### Infrastructure

**Q1 2026:**
- Automated testing improvements
- CI/CD enhancements
- Performance monitoring
- Browser compatibility testing automation

**Ongoing:**
- Security audits
- Dependency updates
- Code quality improvements
- Documentation maintenance

**No plans for:**
- Backend services
- Database infrastructure
- API development
- Cloud hosting

---

## Release Philosophy

### After v2.0 (Late 2026)

miniCycle enters **"Stable Maintenance Mode"**:

- **Major releases:** Only for breaking changes (rare)
- **Minor releases:** Only for new small features (occasional)
- **Patch releases:** Security & bugs (as needed)

**This is intentional.**

miniCycle is designed to be:
- Feature-complete for its purpose
- Stable and reliable
- Low-maintenance
- Always available

Complex features belong in paid tiers where they can be properly supported.

---

## Success Metrics

### For miniCycle (Free Tier)

**Primary Goals:**

1. **User acquisition** - Introduce cycling methodology
2. **Engagement** - High cycle completion rates
3. **Education** - Users understand cycling
4. **Conversion awareness** - Users know about Task Cycle/Pro
5. **Satisfaction** - Positive reviews and feedback

**Not measuring:**

- Revenue (miniCycle is free)
- Premium conversions (not the goal)
- Server costs (no servers)

---

## Transparency

### Business Model

**How SparkinCreations sustains development:**

1. **Task Cycle sales** ($25 one-time) - Professional users
2. **Task Cycle Pro subscriptions** ($10-15/month) - Teams
3. **miniCycle is marketing** - Free tier drives awareness

**miniCycle's role in business:**
- Acquire users
- Educate market
- Build trust
- Provide free option

**This keeps miniCycle:**
- ✅ Forever free
- ✅ No ads
- ✅ No data mining
- ✅ No dark patterns
- ✅ Genuinely useful (not crippled free tier)

---

## Get Involved

### Ways to Help miniCycle

- ⭐ Star the repo
- 🐛 Report bugs
- 💡 Suggest improvements (within scope)
- 📝 Improve docs
- 💻 Contribute code
- 📢 Share with friends
- ❤️ Use it and provide feedback

### Support Development

Want to support continued development?

- **Buy Task Cycle** ($25 one-time) when you need professional features
- **Subscribe to Task Cycle Pro** if you need team features
- **Recommend** to professionals who could benefit

**Don't feel obligated.** miniCycle is truly free, no strings attached.

---

## Questions

### "Will miniCycle ever have [cloud sync/teams/etc]?"

**No.** Those features exist in Task Cycle Pro to fund continued development.

### "Will miniCycle become paid?"

**Never.** It's our commitment to the community and our marketing strategy.

### "Will miniCycle get abandoned?"

**No.** As long as SparkinCreations exists, miniCycle will be maintained.

### "Can I use miniCycle commercially?"

**Yes!** But consider Task Cycle ($25) if you're using it professionally. It has features designed for professional workflows.

### "Why not just make everything free?"

Professional features require ongoing development, support, and potentially infrastructure (cloud sync). Paid tiers ensure sustainable development while keeping core habit-building free.

---

**Roadmap Version:** 2.1
**Next Review:** March 2026

*miniCycle: Forever free, forever focused on personal habit building.*
