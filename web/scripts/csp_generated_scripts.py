"""
csp_generated_scripts.py — hash the inline scripts that are WRITTEN AT RUNTIME.

Why this exists
---------------
`miniCycle.html`'s pre-boot version check halts HTML parsing by writing an
unclosed `<script>` tag and then streaming the script body in via further
`document.write()` calls. The browser executes that as an inline script and
applies CSP to it — but it is not a literal `<script>` element in the file, so
the `SCRIPT_RE` scan used by both `validate-csp.py` and the CSP stage of
`update-version.sh` cannot see it.

The consequence was a silent production failure. The CSP directive was rebuilt
from the literal blocks alone, so the generated script's hash was dropped, the
browser blocked it, and the pre-boot "clear every cache and service worker
before modulepreloads fetch stale content" path never ran — while every gate
stayed green, because every gate was blind to exactly the same script. Measured
on live minicycle.app at v2.424: caches were not cleared, the service worker was
not unregistered, no reload happened, and the spinner markup was left stranded in
the DOM. The app still booted (parsing continues after the blocked script), which
is why it went unnoticed.

The file's own comment said the hash "can be precomputed" — but a precomputed
constant pasted into the configs is wiped by the next `update-version.sh` run,
which rewrites the directive to exactly the set it can derive. So it is DERIVED
here instead, from the same source of truth, and both callers use this module.

What it parses
--------------
The opener is the `document.write(...)` call whose string ends in `<script>`.
Everything up to the call containing the split `'</' + 'script>'` closer is
script BODY, and the browser hashes the concatenation of those literals. Markup
written in the opener call is NOT part of the body (it precedes the `<script>`),
which is why interpolating a version line there does not change this hash.

If the shape ever stops matching, this returns nothing and the caller says so —
a loud miss, not a silent one.
"""

import base64
import hashlib
import re

# End of the `document.write(…'<script>');` opener — the point where script BODY
# begins. Anchored on the tail rather than the whole call on purpose: the opener
# concatenates (`'…markup…' + versionLineHtml + '<script>'`) and its markup carries
# inline CSS full of semicolons, so neither a single-literal pattern nor a
# "no semicolons" pattern can span the call. The caller confirms a preceding
# `document.write(` so this cannot latch onto an unrelated '<script>' string.
OPENER_TAIL_RE = re.compile(r"""'<script>'\s*\)\s*;""")
WRITE_CALL = 'document.write('
# A plain `document.write('…');` body chunk (single-quoted literal, no concatenation).
CHUNK_RE = re.compile(r"""document\.write\(\s*'((?:[^'\\]|\\.)*)'\s*\)\s*;""")
# The split closer, written as '</' + 'script>…' so it neither ends the real
# script element nor trips SCRIPT_RE. Its presence terminates a body. The second
# literal is NOT required to stop at the tag — the shipped closer continues
# `'script></body></html>'` — so match the tag prefix only.
CLOSER_RE = re.compile(r"""document\.write\(\s*'</'\s*\+\s*'script>""")

# JS string-literal escapes that can appear in these chunks. Kept deliberately
# small: the shipped chunks use double quotes inside single-quoted literals, so
# nothing needs escaping today. Anything outside this set is a shape change and
# should fail loudly rather than hash to something subtly wrong.
_UNESCAPE = {"\\'": "'", '\\"': '"', '\\\\': '\\', '\\n': '\n', '\\t': '\t'}
_ESCAPE_RE = re.compile(r"\\.")


def _unescape(literal):
    """Turn a JS single-quoted literal's raw text into the string JS would build."""
    return _ESCAPE_RE.sub(lambda m: _UNESCAPE.get(m.group(0), m.group(0)), literal)


def generated_script_bodies(html):
    """
    Extract every runtime-generated inline script body from one HTML source.

    @param html: full text of an HTML file
    @return: list of script bodies, exactly as the browser will see them
    """
    bodies = []
    for opener in OPENER_TAIL_RE.finditer(html):
        # The tail must belong to a document.write call, not some other string
        # that happens to end in '<script>'.
        if html.rfind(WRITE_CALL, 0, opener.start()) < 0:
            continue
        rest = html[opener.end():]
        closer = CLOSER_RE.search(rest)
        if not closer:
            continue  # no terminator — not a generated-script block we understand
        region = rest[:closer.start()]
        chunks = [_unescape(m.group(1)) for m in CHUNK_RE.finditer(region)]
        body = ''.join(chunks)
        if body.strip():
            bodies.append(body)
    return bodies


def generated_script_hashes(paths):
    """
    CSP hashes for every runtime-generated inline script across `paths`.

    @param paths: iterable of HTML file paths (missing files are skipped)
    @return: list of "'sha256-…'" strings, de-duplicated, source order preserved
    """
    out = []
    seen = set()
    for path in paths:
        try:
            html = open(path, encoding='utf-8').read()
        except (FileNotFoundError, IOError):
            continue
        for body in generated_script_bodies(html):
            digest = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
            entry = "'sha256-%s'" % digest
            if entry not in seen:
                seen.add(entry)
                out.append(entry)
    return out
