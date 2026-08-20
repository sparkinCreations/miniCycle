# Diagnostic probes

One-off Playwright scripts that drive the **real running app** and print what it
actually did. They are debugging instruments, not tests: nothing runs them in CI,
they assert nothing, and a probe may be deleted the moment its question is answered.

A probe answers "what does the app really do here?" during an investigation. Once
the answer is known, the behaviour gets pinned by a real test in `web/tests/` —
the probe is the scaffolding, the test is the guarantee.

## Running one

The dev server must be up (`npm start`), because probes navigate to
`http://localhost:8080/miniCycle.html`:

```bash
cd web
npm start                                       # in another shell
node tests/automated/probes/<name>.cjs
```

## Writing one

Two things bite every time:

- **`serviceWorkers: 'block'`** in `newContext()`. Without it a cached service
  worker serves stale modules and the probe measures the previous version.
- **The app's console capture swallows `console.log` from page code.** Return
  values out of `page.evaluate()` and log them from Node, or push onto a
  `globalThis` array and read it back. Logging inside the page reads as
  "the code never ran".

First run also shows the onboarding screen — click
`.first-run-btn[data-choice="learn"]`, then dismiss `#first-run-welcome-dismiss`.

## Why they live here

They were briefly committed to `web/` root, where the release build's blanket
copy pass (`scripts/build-web.cjs`, `copyStatic`) swept them into `dist/` and
published them at the site root. `tests/` is deliberately published as a separate
origin, so this is the right home for test scaffolding. Do not put scratch
scripts at the `web/` root.
