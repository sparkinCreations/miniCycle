# Contributing to miniCycle

Contributions are welcome. miniCycle is source-available under a proprietary
license (see [LICENSE](LICENSE)), which means forking and modifying the code
requires prior written consent from Sparkin Creations.

Getting that consent is easy. Open an issue describing what you'd like to work
on and you'll get written permission to fork the repository and submit a pull
request.

## How to contribute

1. **Open an issue first.** Describe the bug you want to fix or the change you
   want to make. This is where permission to fork is granted, so this step is
   required.
2. **Wait for a reply.** You'll get a yes (usually), plus any context on how the
   change should fit the existing architecture.
3. **Fork, branch, and build.** Follow
   [web/docs/start-here/FIRST_CONTRIBUTION.md](web/docs/start-here/FIRST_CONTRIBUTION.md),
   which covers setup, the code patterns you'll use most, and the PR checklist.
4. **Open the pull request.** Every CI check has to pass. See
   [Before you open the PR](#before-you-open-the-pr) below.

## Good first contributions

- Bug fixes with clear reproduction steps
- Test coverage for untested edge cases
- Documentation fixes and improvements
- Accessibility work (ARIA labels, keyboard navigation, screen reader support)

Look for issues labeled `good first issue`. For anything larger, especially
changes that span multiple modules, open an issue to talk through the approach
before writing code. Dependency injection is wired through four layers and a
missed layer fails silently.

## What you should know before starting

- **Read [web/docs/start-here/HOW_MINICYCLE_WORKS.md](web/docs/start-here/HOW_MINICYCLE_WORKS.md).**
  It takes about 20 minutes and covers the architecture from start to finish.
- **Data changes go through `AppState.update()`.** Most other conventions in the
  codebase are there to support that.
- **There's no build step for development.** Clone, `npm install`, `npm start`,
  and open the app. The esbuild bundle is only for releases.

## Before you open the PR

`npm test` only runs the module suites. CI runs more suites and static checks than
that, so run these from `web/` before opening a PR:

```bash
# Static checks, no server needed
npm run lint                # ESLint; fails above the --max-warnings ratchet
npm run validate:di         # DI declarations vs actual usage
npm run validate:legacy     # legacy-read ratchet
npm run validate:inline     # inline scripts in miniCycle.html
npm run validate:comments   # identifiers named in comments must exist
npm run validate:builtins   # no post-es2020 built-ins (they ship verbatim)
npm run validate:labels     # every getLabel() key resolves
npm run validate:docs       # docs links and sidebar

# Module suites, need a server
npm start                   # separate terminal, port 8080
npm test

# Real-app suites, each starts its own server
npm run test:layout
npm run test:a11y
npm run test:sw
npm run test:meta
npm run test:journey
npm run test:contrast
```

**`npm run test:journey` catches DI wiring gaps.** If a module uses a dependency it
never declared, nothing throws and the feature just stops working. The journey suite
drives the real app and fails on the app's `DI access` / `missing required dep`
warnings. Unit tests can't catch this because they inject dependencies directly.

**If you add a module file, run `npm run test:sw`.** It fails when a module in the
boot graph is missing from `BOOT_CRITICAL` in `service-worker.js`. Nothing else
catches that, and the module would break offline boot.

Full reference: [web/docs/working-on-code/VALIDATION_GATES.md](web/docs/working-on-code/VALIDATION_GATES.md).

## Licensing of contributions

By submitting a pull request, you agree that your contribution is assigned to
Sparkin Creations and may be distributed under the project's license. You retain
no separate claim over merged code. This keeps the licensing of the codebase
clear, because GitHub's default inbound terms ("under the same terms" as the
repository) don't work cleanly with a view-only license.

If that doesn't work for you, say so in the issue and we can talk about it.

## Trademarks and derivative products

- The miniCycle name, logo, and brand identity remain trademarks of Sparkin
  Creations and are not covered by contribution permission.
- Permission to fork for the purpose of contributing is not permission to
  distribute a derivative product. If that's what you're after, reach out at
  admin@sparkinCreations.com and we'll discuss terms separately.

## Related

- [web/docs/start-here/FIRST_CONTRIBUTION.md](web/docs/start-here/FIRST_CONTRIBUTION.md):
  a step-by-step walkthrough of your first PR
- [web/docs/project-info/CONTRIBUTING.md](web/docs/project-info/CONTRIBUTING.md):
  how modules communicate and how to extend them safely

## Questions

Open an issue, or email admin@sparkinCreations.com.
