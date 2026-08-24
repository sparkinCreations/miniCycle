#!/usr/bin/env python3
"""Sync the CSP script-src hash list across every deployment config.

Extracted verbatim from the 111-line Python heredoc inside update-version.sh
(Aug 2026, splits-plan Priority 7). Behaviour is unchanged; what changed is that
it can now be RUN and TESTED on its own, against a fixture directory, instead of
only as a side effect of cutting a release.

WHY THIS ONE MOVED FIRST: update-version.sh is the release gate — every app-code
change ships through it — and its failures are silent. A wrong hash list does not
error; it produces a deploy where a script is blocked in production while every
gate stays green. Both incidents recorded below shipped exactly that way.

Model: scripts/changelog-range.sh, which became testable the same way and
immediately gained a suite covering the boundary case that had shipped three
wrong changelogs.

The canonical hash set is derived from the inline <script> blocks in the
DISCOVERED html sources, then applied to every config in its native script-src
format (netlify.toml + nginx = single line; .htaccess = Apache multi-line "\\"
continuation). Only the script-src hash list is touched — every other directive
is preserved, and configs may legitimately differ in those.

Usage:
    python3 scripts/csp_hash_sync.py [--root DIR]

Exit 0 always (informational); prints what changed. The hard gate is
validate-csp.py, which runs separately and fails the release.
"""

import base64
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from csp_generated_scripts import generated_script_hashes, discover_html_sources  # noqa: E402

CONFIGS = ['netlify.toml', '.htaccess', 'nginx-security.conf']

COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
PATTERN = r"script-src 'self'.*?;"


def strip_comments(html):
    """Blank out HTML comments before matching script blocks.

    WHY (v2.316 postmortem): the browser treats comments as comments, but a bare
    regex does not. A literal script tag written in PROSE inside a comment starts
    a bogus non-greedy match that swallows everything up to the next REAL closing
    tag — emitting a junk hash for [prose + real block] while the real block's
    true hash never reaches the CSP. The browser then blocks that script in
    production. The block COUNT is unchanged, so counting can't detect it.
    v2.316 shipped this way and blocked the async main-CSS loader.

    Spaces (not '') preserve length so line numbers stay meaningful.
    """
    return COMMENT_RE.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), html)


def canonical_hashes(root='.', warn=print):
    """The de-duplicated hash set every config must carry, in insertion order.

    Includes runtime-generated (document.write'd) inline scripts, which SCRIPT_RE
    cannot see but the browser DOES hash. Omitting them is not cosmetic: the sync
    below rewrites the directive to exactly this list, so any hand-added hash for
    them is deleted on the next release — which is how the pre-boot cache-clear
    script came to be CSP-blocked in production while every gate stayed green
    (v2.424).
    """
    src_files = discover_html_sources(root)
    # discover_html_sources returns paths relative to `root`, but every consumer
    # below opens them directly — which resolves against the CWD. Those agree in
    # production (update-version.sh runs from web/ with root='.') and diverge
    # anywhere else, silently hashing the real files instead of the given root.
    # Resolve once, here.
    resolved = [f if os.path.isabs(f) else os.path.join(root, f) for f in src_files]
    hashes = []
    for f, path in zip(src_files, resolved):
        try:
            html = open(path).read()
        except FileNotFoundError:
            continue
        # Nudge authors away from the footgun even though it is now handled.
        for m in COMMENT_RE.finditer(html):
            if re.search(r'</?script', m.group(0)):
                warn("⚠️  %s: literal script tag inside an HTML comment near line %d — "
                     "handled, but write \"script element\" in prose instead."
                     % (f, html[:m.start()].count('\n') + 1))
        for s in SCRIPT_RE.findall(strip_comments(html)):
            if s.strip():
                h = base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
                hashes.append("'sha256-%s'" % h)

    generated = generated_script_hashes(resolved)
    if generated:
        warn("🧩 %d runtime-generated inline script(s) hashed (document.write'd)" % len(generated))
    else:
        warn("⚠️  No runtime-generated inline scripts detected — if miniCycle.html still "
             "document.write's one, its CSP hash is about to be dropped (see "
             "scripts/csp_generated_scripts.py)")
    hashes.extend(generated)

    seen = set()
    return [h for h in hashes if not (h in seen or seen.add(h))]


def render_single(c):
    """netlify.toml / nginx: one line."""
    return "script-src 'self' " + " ".join(c) + ";"


def render_htaccess(c):
    """Apache: 8-space directive, 12-space hash lines, trailing " \\" continuations;
    the final hash closes the directive with ";"."""
    lines = ["script-src 'self' \\"]
    lines += ["            %s \\" % h for h in c[:-1]]
    lines.append("            %s;" % c[-1])
    return "\n".join(lines)


def sync_configs(root, canon, log=print):
    """Rewrite each config's script-src to `canon`. Returns the number changed."""
    canon_set = set(canon)
    changed = 0
    for cfg in CONFIGS:
        path = os.path.join(root, cfg)
        if not os.path.exists(path):
            log("⏭️  %s not found — skipping" % cfg)
            continue
        content = open(path).read()
        m = re.search(PATTERN, content, re.DOTALL)
        if not m:
            log("⚠️  %s has no script-src 'self' directive — skipping" % cfg)
            continue
        current = re.findall(r"'sha256-[^']+'", m.group(0))
        cur = set(current)
        missing = [h for h in canon if h not in cur]
        stale = [h for h in current if h not in canon_set]
        if not missing and not stale:
            log("✅ %s — already canonical (%d hashes)" % (cfg, len(canon)))
            continue
        repl = render_htaccess(canon) if cfg.endswith('.htaccess') else render_single(canon)
        # lambda => replacement string is treated literally (no backslash/group escapes).
        content = re.sub(PATTERN, lambda _m: repl, content, count=1, flags=re.DOTALL)
        open(path, 'w').write(content)
        changed += 1
        for h in missing:
            log("   + %s  (%s)" % (h, cfg))
        for h in stale:
            log("   - %s  (%s)" % (h, cfg))
        log("✅ %s — updated script-src (+%d new, -%d stale → %d total)"
            % (cfg, len(missing), len(stale), len(canon)))
    return changed


def main(argv):
    root = '.'
    if '--root' in argv:
        root = argv[argv.index('--root') + 1]

    canon = canonical_hashes(root)
    if not canon:
        print("ℹ️  No inline scripts found to hash")
        return 0

    changed = sync_configs(root, canon)
    if changed == 0:
        print("✅ All CSP configs already match the canonical hash set (%d hashes)" % len(canon))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
