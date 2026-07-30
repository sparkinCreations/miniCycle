# Validation Gates

> **What runs, when it runs, and what a failure actually means.**
>
> Every gate here is zero-dependency (Python stdlib or Node already in the project) and
> runs from `web/`. None of them need a dev server except the test suites.

**Last Updated:** July 28, 2026

---

## The gates at a glance

| Gate | Command | Runs automatically | Blocking? |
|------|---------|--------------------|-----------|
| **CSP coverage** | `npm run validate:csp` | `update-version.sh` (pre-push) | 🔴 **Blocks the release** |
| **HTML validity** | `npm run validate:html` | CI — `performance.yml` | 🔴 Fails CI |
| **Docs links + nav** | `npm run validate:docs` | CI — `performance.yml` | 🔴 Fails CI |
| **Lint** | `npm run lint` | CI — `test.yml` | 🔴 Fails CI on any error, or on warnings above the `--max-warnings` ratchet in `package.json` (lower it after cleanup; never raise it) |
| **Module tests** | `npm test` | CI — `test.yml` | 🔴 Fails CI |
| **Real-app gates** | `npm run test:layout` · `test:sw` · `test:journey` | CI — `test.yml` | 🔴 Fails CI |
| **Performance** | `npm run perf` | CI — `performance.yml` | 🔴 Fails CI |
| **DI declarations** | `npm run validate:di` | CI — `test.yml` | 🟡 Partially gated (undeclared=0, nowhere=0, unused ratchet; facade advisory) |
| **Inline scripts** | `npm run validate:inline` | CI — `test.yml` | 🔴 Fails CI — empty catch blocks in miniCycle.html inline scripts must carry an intent comment (ESLint's `no-empty` can't see the file — drift-review D-01) |

---

## 🔴 `validate:csp` — the one that stops a release

**Checks:** every inline `<script>` in the shipped HTML has a matching SHA-256 hash in
**all three** deployment configs — `netlify.toml`, `.htaccess`, `nginx-security.conf`.

**Why it blocks:** editing *any* inline script changes its hash. Ship without regenerating
and the browser refuses to execute that block under CSP — which, for the boot scripts, means
a white screen. `update-version.sh` runs this as a hard pre-push gate for exactly that
reason; it regenerates the hashes itself, so the gate is really a check that regeneration
worked.

**If it fails:** you almost certainly edited an inline script and pushed without
`./scripts/update-version.sh`. Re-run the release script rather than hand-editing hashes.

## 🔴 `validate:html` — W3C (Nu) validity

**Checks:** the maintained pages against `validator.w3.org/nu`. Only **errors** gate;
the pages carry a few intentional warnings (trailing slashes on void elements, redundant
landmark roles).

**Note:** this is the one gate that needs network access. `--dist` validates the built
artifacts instead of source.

## 🔴 `validate:docs` — links, nav, and AI routing

**Checks three things** ([scripts/validate-docs.py](../../scripts/validate-docs.py)):

1. **Broken relative links** — every `[text](path)` in `docs/` resolves on disk.
2. **Sidebar orphans** — every `.md` is reachable from `_sidebar.md`. An unlisted doc is an
   invisible doc.
3. **CLAUDE.md routing** — every `web/docs/…md` path in the **repo-root `CLAUDE.md`**
   resolves.

**Check 3 is the important one.** A stale path there fails *silently* — no error, no broken
page. It just routes an AI session to a file that no longer exists and quietly degrades
every change made afterward.

`archive/` and `vendor/` are excluded: historical snapshots are allowed to point at the
world as it was, and "fixing" them would mean editing archived docs, which
[the archive rule](../../../CLAUDE.md) forbids. Source citations (`gamesManager.js:124`),
paths outside the repo, and malformed link text are classified as non-file links rather than
reported as broken — run with `--list` to see them.

**If it fails:** move the doc back, fix the link, or add the missing `_sidebar.md` entry.
See [CONTRIBUTING §Where a new document goes](../project-info/CONTRIBUTING.md) for which
folder a new doc belongs in.

**Why it exists:** the July 2026 reorganization uncovered rot that had built up silently for
months — 60 broken links, 9 dead sidebar entries, and 22 unreachable docs including 7 of the
12 guides the root `CLAUDE.md` mandates reading. Nothing checked, so nothing surfaced.

## 🟡 `validate:di` — partially gated (July 2026)

**Checks:** module DI declarations against actual usage — deps accessed but not declared in
`moduleManifests.js`, declared but never used, and accessed-but-resolvable-nowhere.

**Gated (exit 1) since the July 2026 drift review** (C-23), which cleared the standing
findings first:

- 🔴 **used-but-undeclared** — must be 0 (was already the hard gate)
- ⚪ **resolvable-nowhere** — must be 0. The 5 standing items were cleared, so any new one
  is a freshly-introduced dead dep. Genuinely runtime-wired deps (no static route the
  scanner can see) go in `RUNTIME_WIRED` in `scripts/validate-di-deps.js` **with their
  wiring call site named** — it's an exemption list, not a mute button.
- 🟡 **declared-but-unused** — ratchet: must not exceed `UNUSED_BASELINE` in the script.
  Lower the baseline after real cleanup; never raise it.
- 🟠 **facade forward-through** — still advisory (facades legitimately forward deps).

**The diff workflow is still the best review habit** when touching DI wiring — capture
output before your change and after, and look only at what you added:

```bash
npm run validate:di > /tmp/di-before.txt
# ...make your change...
npm run validate:di > /tmp/di-after.txt
diff /tmp/di-before.txt /tmp/di-after.txt   # empty = you introduced no new DI findings
```

That is how the July 2026 `menuManager` wiring change was verified — identical output before
and after proved the new dependency was declared correctly at every layer.

---

## Running everything locally

```bash
cd web
npm run validate:csp && npm run validate:html && npm run validate:docs && npm run lint
```

The test suites need a server:

```bash
npm start        # separate terminal — port 8080
npm test
```

## Related

- [MAKING_CODE_CHANGES.md](MAKING_CODE_CHANGES.md) — the 4-layer DI pipeline `validate:di` inspects
- [CONTRIBUTING.md](../project-info/CONTRIBUTING.md) — where a new doc goes
- [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md) — what the release script does
- [TESTING_GUIDE.md](TESTING_GUIDE.md) — the test suites in depth
