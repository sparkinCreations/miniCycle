# Doc Drift Audit Checklist

Purpose: Track documentation that appears out of sync with the current zero-globals + strict DI architecture.

## Status Legend
- [ ] Not reviewed
- [~] Needs update (confirmed drift)
- [x] Updated
- [-] Intentional legacy note added

## High Priority
- [x] docs/developer-guides/DEVELOPMENT_WORKFLOW.md
  - Updated to use DI/appContext patterns; removed window.* examples.
- [x] docs/developer-guides/APPINIT_SYSTEM.md
  - Updated to use injected `appInit`/`AppState` and versioned imports.
- [x] docs/deployment/UPDATE-VERSION-GUIDE.md
  - Updated to `globalThis.APP_VERSION`, current script v5.2, and file lists.
- [x] docs/deployment/SERVICE_WORKER_UPDATE_STRATEGY.md
  - Updated to inlined SW versioning and consistent appInit import notes.
- [x] docs/features/TASK_OPTIONS_CUSTOMIZER.md
  - Updated examples to DI/appContext and module imports.
- [x] docs/features/minicycle-recurring-guide.md
  - Updated DI wiring examples and module paths.
- [x] docs/developer-guides/MODULE_SYSTEM_GUIDE.md
  - Labeled legacy patterns and updated wiring examples.
- [x] docs/PROJECT_STATS.md
  - Clarified module-only zero-globals and HTML helper scope.

## Medium Priority
- [ ] docs/architecture/APPINIT_EXPLAINED.md
  - Notes: Reads like conversational/AI output; consider rewrite or archive (not a code mismatch).

## Verification Steps (when updating)
- [ ] Confirm current code behavior in `modules/` before editing doc claims.
- [ ] Add explicit "legacy pattern" callouts when keeping old examples.
- [ ] Update any doc cross-links that reference changed patterns.
