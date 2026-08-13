# Contributing to miniCycle

Contributions are welcome. miniCycle is source-available under a proprietary
license (see [LICENSE](LICENSE)), which means forking and modifying the code
requires prior written consent from Sparkin Creations.

**That consent is granted on request, and it's a formality — not a hurdle.**
Open an issue describing what you'd like to work on and you'll get written
permission to fork the repository and submit a pull request.

## How to contribute

1. **Open an issue first.** Describe the bug you want to fix or the change you
   want to make. This is also where permission to fork is granted, so it's the
   required first step rather than an optional courtesy.
2. **Wait for a reply.** You'll get a yes (usually), plus any context on how the
   change should fit the existing architecture.
3. **Fork, branch, and build.** Follow
   [web/docs/start-here/FIRST_CONTRIBUTION.md](web/docs/start-here/FIRST_CONTRIBUTION.md)
   — it covers setup, the five daily code patterns, and the PR checklist.
4. **Open the pull request.** Every CI gate must pass — see
   [Before you open the PR](#before-you-open-the-pr) below.

## Good first contributions

- Bug fixes with clear reproduction steps
- Test coverage for untested edge cases
- Documentation fixes and improvements
- Accessibility work (ARIA labels, keyboard navigation, screen reader support)

Look for issues labeled `good first issue`. For anything larger — especially
changes that span multiple modules — open an issue to discuss the approach
before writing code. The dependency-injection wiring path is four layers deep
and a missed layer fails silently, so it's worth a conversation first.

## What you should know before starting

- **Read [web/docs/start-here/HOW_MINICYCLE_WORKS.md](web/docs/start-here/HOW_MINICYCLE_WORKS.md).**
  Roughly 20 minutes, and it covers the whole architecture end to end.
- **The one rule for new code:** data changes go through `AppState.update()`.
  Nearly every other convention in the codebase exists to protect that one.
  (Older code still reads through the `loadMiniCycleData()` wrapper — a ratcheted
  gate keeps that count from growing. Don't add to it.)
- **No build step to develop.** Clone, `npm install`, `npm start`, open the file.
  The esbuild bundle is for releases only.

## Before you open the PR

`npm test` is **not** the full test set — it runs the module suites only. CI runs
four more suites and eight static gates, and a PR that skips them goes red on
checks you never saw locally. Run these from `web/`:

```bash
# Static gates — no server needed
npm run lint                # ESLint; fails above the --max-warnings ratchet
npm run validate:di         # DI declarations vs actual usage
npm run validate:legacy     # legacy-read ratchet
npm run validate:inline     # inline scripts in miniCycle.html
npm run validate:comments   # identifiers named in comments must exist
npm run validate:builtins   # no post-es2020 built-ins (they ship verbatim)
npm run validate:labels     # every getLabel() key resolves
npm run validate:docs       # docs links, sidebar, and CLAUDE.md routing

# Module suites — need a server
npm start                   # separate terminal, port 8080
npm test

# Real-app suites — each starts its own server
npm run test:layout
npm run test:sw
npm run test:meta
npm run test:journey
```

**If you add a module file, `npm run test:sw` is the one that matters.** Its
precache drift guard fails when a module in the boot graph is missing from
`BOOT_CRITICAL` in `service-worker.js`. Nothing else catches it — a new module
can pass the entire browser suite and every other gate while leaving offline
boot broken.

Full reference: [web/docs/working-on-code/VALIDATION_GATES.md](web/docs/working-on-code/VALIDATION_GATES.md).

## Licensing of contributions

By submitting a pull request, you agree that your contribution is assigned to
Sparkin Creations and may be distributed under the project's license. You retain
no separate claim over merged code. This keeps the licensing of the codebase
unambiguous — with a view-only license, the inbound grant in GitHub's terms
("under the same terms" as the repository) doesn't resolve cleanly on its own.

If that doesn't work for you, say so in the issue and we can talk about it.

## What this doesn't change

- The miniCycle name, logo, and brand identity remain trademarks of Sparkin
  Creations and are not covered by contribution permission.
- Permission to fork for the purpose of contributing is not permission to
  distribute a derivative product. If that's what you're after, reach out at
  admin@sparkinCreations.com and we'll discuss terms separately.

## Related

- [web/docs/start-here/FIRST_CONTRIBUTION.md](web/docs/start-here/FIRST_CONTRIBUTION.md)
  — step-by-step walkthrough for your first PR
- [web/docs/project-info/CONTRIBUTING.md](web/docs/project-info/CONTRIBUTING.md)
  — the architecture guide: how modules communicate and how to extend them
  safely. This file covers *whether and how* to contribute; that one covers
  *what the code expects of you* once you start.

## Questions

Open an issue, or email admin@sparkinCreations.com.
