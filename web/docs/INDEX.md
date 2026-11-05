# miniCycle Documentation Index

> **Start here by task.** Find what you are about to do; the first link is the
> doc to read first. This page routes — it does not list everything.
> The full map is the **sidebar** (`_sidebar.md`); live numbers (versions,
> module and test counts) are only in **[PROJECT_STATS.md](PROJECT_STATS.md)**.

**Last verified:** Nov 5 2026 (docs audit round 1 — replaced the 780-line
catalogue and absorbed `DEVELOPER_DOCUMENTATION.md`, now archived)

---

## I'm new to miniCycle

1. [What is miniCycle?](start-here/WHAT_IS_MINICYCLE.md) — the product: a routine manager, not a to-do app
2. [How miniCycle works](start-here/HOW_MINICYCLE_WORKS.md) — boot, state, DI and rendering in one read
3. [Getting started](start-here/GETTING_STARTED.md) and [the dev server](start-here/DEV_SERVER.md)
4. [Your first contribution](start-here/FIRST_CONTRIBUTION.md)
5. Reference while you read: [folder structure](start-here/FOLDER_STRUCTURE.md),
   [framework equivalents](start-here/FRAMEWORK_EQUIVALENTS.md) (framework patterns → what miniCycle builds by hand)

## I'm about to change code — read the matching guide first

The same routing as the repo-root `CLAUDE.md` "Read These First" list:

| If your change… | Read |
|---|---|
| wires a shared function across modules | [MAKING_CODE_CHANGES](working-on-code/MAKING_CODE_CHANGES.md) |
| adds constants, ids, classes or selectors | [CONSTANTS_SYSTEM_GUIDE](working-on-code/CONSTANTS_SYSTEM_GUIDE.md) |
| adds a module or a DI dependency | [DI_PATTERNS](working-on-code/DI_PATTERNS.md) + [MODULE_LOADER_GUIDE](architecture/MODULE_LOADER_GUIDE.md) |
| builds a modal, menu, or anything with listeners | [HOW_TO_ADD_COOKBOOK](working-on-code/HOW_TO_ADD_COOKBOOK.md) |
| adds or changes user-facing strings | [CODING_STANDARDS](working-on-code/CODING_STANDARDS.md) §Label System |
| decides where a message belongs | [MESSAGING_SURFACES](working-on-code/MESSAGING_SURFACES.md) |
| touches a facade module or its sub-modules | [HIDDEN_CODEBASE_INSIGHTS](working-on-code/HIDDEN_CODEBASE_INSIGHTS.md) |
| touches event handlers, AppState updates or async UI | [EVENT_LISTENER_GUIDE](working-on-code/EVENT_LISTENER_GUIDE.md) + [ASYNC_UI_PATTERNS](working-on-code/ASYNC_UI_PATTERNS.md) |
| changes focus-mode / task-view geometry | [FOCUS_VIEW_LAYOUT](architecture/FOCUS_VIEW_LAYOUT.md) |
| reviews or refactors anything | [REVIEW_PATTERNS](reference/REVIEW_PATTERNS.md) |

The day-to-day loop (change, test, ship): [development workflow](working-on-code/DEVELOPMENT_WORKFLOW.md).

Working with an AI assistant: [working-on-code/CLAUDE.md](working-on-code/CLAUDE.md)
(the detailed reference behind the root `CLAUDE.md`) and
[AI-assisted development](working-on-code/AI_ASSISTED_DEVELOPMENT.md).

## I need to understand how something is built

- **The big picture:** [architecture overview](architecture/ARCHITECTURE_OVERVIEW.md),
  [codebase visual map](architecture/CODEBASE_VISUAL_MAP.md),
  [why it is built this way](ARCHITECTURE_DECISIONS.md) (the ADRs)
- **Boot and wiring:** [two-phase initialization](architecture/APPINIT_EXPLAINED.md),
  [module dependency map](architecture/DEPENDENCY_MAP.md)
- **Stored data:** [data schema guide](reference/DATA_SCHEMA_GUIDE.md) and
  [Schema 2.6](reference/SCHEMA_2_6.md); the `.mcyc` sharing format:
  [MCYC_FILE_FORMAT](reference/MCYC_FILE_FORMAT.md)
- **Module APIs:** [API reference](reference/API_REFERENCE.md);
  label keys: [label registry](reference/LABEL_REGISTRY_REFERENCE.md)
- **One feature:** the sidebar's *Features* and *Architecture* sections;
  everything the app does: [feature list](reference/FEATURE_LIST.md)

## I'm testing a change

- [Testing guide](working-on-code/TESTING_GUIDE.md) — how to write and run tests
- [Testing README](testing/TESTING_README.md) and
  [testing architecture](testing/TESTING_ARCHITECTURE.md) — the suites and how they fit
- [Validation gates](working-on-code/VALIDATION_GATES.md) — every `validate:*` check
  and what it catches. `npm test` is not the full set; CI runs the real-app suites too.

## I'm shipping

Every push to `main` deploys. App-code changes ship only through
`cd web && ./scripts/update-version.sh --auto --push --changelog`.

- [Build process](deployment/BUILD_PROCESS.md) — the release bundle and how to verify a deploy
- [Update-version guide](deployment/UPDATE-VERSION-GUIDE.md) — what the release script does
- [Deployment](deployment/DEPLOYMENT.md),
  [service-worker update strategy](deployment/SERVICE_WORKER_UPDATE_STRATEGY.md),
  [PWA offline architecture](deployment/PWA_OFFLINE_ARCHITECTURE.md)

## Something is broken

- [Error recovery](working-on-code/ERROR_RECOVERY.md) — what the app does with bad or missing data
- [Review patterns](reference/REVIEW_PATTERNS.md) — the known fault lines, most with a measured incident
- The sidebar's *Incidents* section — postmortems of past breakages

## Security, performance, planning

- **Security:** [security guide](working-on-code/SECURITY_GUIDE.md) (how to write safe code)
  and [security policy](security/SECURITY.md)
- **Performance:** [performance testing guide](performance/PERFORMANCE_TESTING_GUIDE.md)
  and the [boot performance roadmap](future-work/BOOT_PERF_ROADMAP.md)
- **What is next:** [roadmap](project-info/ROADMAP.md) and the sidebar's *Future Work*
  section; shipped plans move to *Archive*
- **Contributing:** [contributing guide](project-info/CONTRIBUTING.md)
