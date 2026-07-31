# Doc Drift Audit Checklist

Purpose: Track documentation that appears out of sync with the current code — both
developer docs (vs the zero-globals + strict DI architecture) and **public surfaces**
(vs actual app behavior). The July 2026 external drift review found that every one of
its copy findings lived on public surfaces this checklist didn't cover; the Public
Surfaces section below closes that gap.

## Status Legend
- [ ] Not reviewed
- [~] Needs update (confirmed drift)
- [x] Updated
- [-] Intentional legacy note added

## High Priority
- [x] docs/working-on-code/DEVELOPMENT_WORKFLOW.md
  - Updated to use DI/appContext patterns; removed window.* examples.
- [x] docs/architecture/APPINIT_SYSTEM.md
  - Updated to use injected `appInit`/`AppState` and versioned imports.
- [x] docs/deployment/UPDATE-VERSION-GUIDE.md
  - Updated to `globalThis.APP_VERSION`, current script v5.2, and file lists.
- [x] docs/deployment/SERVICE_WORKER_UPDATE_STRATEGY.md
  - Updated to inlined SW versioning and consistent appInit import notes.
- [x] docs/features/TASK_OPTIONS_CUSTOMIZER.md
  - Updated examples to DI/appContext and module imports.
- [x] docs/features/minicycle-recurring-guide.md
  - Updated DI wiring examples and module paths.
- [x] docs/architecture/MODULE_SYSTEM_GUIDE.md
  - Labeled legacy patterns and updated wiring examples.
- [x] docs/PROJECT_STATS.md
  - Clarified module-only zero-globals and HTML helper scope.
  - Fixed boot fallback descriptions (8-second late fallback, 60-second load timeout).
- [x] docs/project-info/CONTRIBUTING.md
  - Fixed /src → /modules paths, removed window.* examples, updated all code samples to DI patterns.
  - Added social layer: PR process, code review expectations, Good First Issue guidance.
- [x] docs/DEVELOPER_DOCUMENTATION.md
  - Removed window.AppState/window.showNotification examples, updated to _deps.* DI pattern.

## Medium Priority
- [x] docs/architecture/APPINIT_EXPLAINED.md
  - Reviewed: content is accurate and uses DI patterns correctly. Tone is approachable, not conversational/AI-like. No rewrite needed.

## Public Surfaces (added July 2026 — drift-review item 18)

The surfaces users read, measured against what the app actually does. Same discipline
as above: **confirm current code behavior in `modules/` before editing claims** — and
in this direction, prefer fixing the copy to match the code unless the code is wrong.

- [x] pages/learn_more.html
  - July 2026: "Completed tasks are deleted" → recoverable-for-90-days (verified `PRUNE_DAYS`);
    Focus Mode → Focus View; removed "streaks maintained" (feature removed).
  - July 31 (A-06b): Backup & Restore card rewritten AGAIN — the first rewrite (from the
    later-withdrawn A-06) framed backups as manual export, hiding the three automatic
    tiers backupManager actually keeps (10 daily / 5 session / 50 manual, all restorable
    in-app). Copy now leads with the automatic backups, verified against
    `modules/storage/backupManager.js` constants. Lesson: a suggested-copy fix inherits
    the finding's errors — verify the claim, not just the wording.
- [ ] pages/product.html
  - A-10 (open): sells effort claims; consider swapping one assertion for one piece of
    evidence (test counts, validators) for the audience that clicks through to GitHub.
- [x] legal/user-manual.html
  - July 2026: "restore any task" → "recreate… with due date, priority, and recurring
    settings intact"; version stamp refreshed. **Stamp goes stale every release** —
    `validate:docs` now fails if it falls more than 30 minor versions behind `version.js`.
- [x] legal/privacy.html
  - July 2026: self-reference URL verified correct. Privacy claims are load-bearing —
    re-verify against `shareManager`/tracker code whenever export/share/analytics change.
- [x] In-app strings (modules/labels/, modal headers, status lines)
  - July 2026: tapToOpen wording aligned with manual; trailing padlock dropped from
    game-unlocked; "Remaining to unlock" header added to locked badge dialog; Milestone
    Rewards icons aligned with badge row (theme `badge` icons).

### Terminology register
Canonical terms the public surfaces must use:
- **Focus View** (never "Focus Mode") — everywhere user-facing. **Enforced by
  `validate:docs`** (case-sensitive scan of pages/ and legal/).
- Badge icons: 🔥 5 / 💪 25 / 📚 50 / 🧹 75 / 👑 100 — lists naming these milestones use
  the badge-row emoji, not theme celebrate icons (🏆/🎓). Manual review — themes.js
  legitimately uses the celebrate icons elsewhere, so this one isn't mechanically checked.

## Verification Steps (when updating)
- [ ] Confirm current code behavior in `modules/` before editing doc claims.
- [ ] Add explicit "legacy pattern" callouts when keeping old examples.
- [ ] Update any doc cross-links that reference changed patterns.
- [ ] For public surfaces: verify every behavioral claim (retention windows, limits,
      recoverability) against the constant or code path that implements it.
