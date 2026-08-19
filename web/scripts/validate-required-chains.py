#!/usr/bin/env python3
"""
Validate: required() deps are not reached through optional chaining.
=============================================================================
A module that declares a dependency `required()` and then reads it as
`deps.thing?.()` has written a branch that can only be taken when its own
wiring is broken — and the branch does nothing. Missing wiring stops being a
failure and becomes a feature that quietly isn't there.

That is not hypothetical. v2.418 turned on ENFORCE_REQUIRES; three live
features (import mode choice, share mode choice, theme-on-import) went dark
for a day because every consumer optional-chained the dep it had lost. It
took a runtime audit to notice, not a test and not a user.

So: reading a required dep must be unguarded, and a wiring failure must throw
where it happens, naming the dep.

EXCEPTION — inside a `catch` block.
    catch (error) {
        console.warn('...', error);
        _deps.showNotification?.(getLabel('notify.failed'), 'error');
    }
Throwing here would replace the error being reported with a worse one about
the reporting itself. The original diagnostic already reached the console, so
silence on the notification is the right trade. These sites are allowed.

Optional deps are untouched — `?.` is exactly right for them.

Usage:  npm run validate:chains
Exit 0 when clean, 1 on any violation.
"""
import os
import re
import sys

MODULES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'modules')

_CREATE = re.compile(r"createDIModule\s*\(")
_ENTRY = re.compile(r"(?:^|[{,])\s*([A-Za-z_$][\w$]*)\s*:\s*(required|optional)\s*\(", re.M)
_CATCH = re.compile(r"\bcatch\s*(?:\([^)]*\))?\s*\{")


def match_braces(src, start):
    """start = index of '{'; return index just past its matching '}'.

    String- and comment-aware, so a brace inside a template literal or a
    regex-looking comment does not throw the depth count off.
    """
    depth, i, n = 0, start, len(src)
    in_str, quote, esc = False, '', False
    while i < n:
        ch = src[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == quote:
                in_str = False
        elif ch in '"\'`':
            in_str, quote = True, ch
        elif ch == '/' and i + 1 < n and src[i + 1] == '/':
            nl = src.find('\n', i)
            if nl == -1:
                return n
            i = nl
        elif ch == '/' and i + 1 < n and src[i + 1] == '*':
            end = src.find('*/', i)
            if end == -1:
                return n
            i = end + 1
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def required_deps(src):
    """Names the file's own createDIModule schema marks required()."""
    m = _CREATE.search(src)
    if not m:
        return []
    brace = src.find('{', m.end())
    if brace == -1:
        return []
    body = src[brace:match_braces(src, brace)]
    return [name for name, kind in _ENTRY.findall(body) if kind == 'required']


def catch_ranges(src):
    out = []
    for m in _CATCH.finditer(src):
        brace = src.index('{', m.end() - 1)
        out.append((brace, match_braces(src, brace)))
    return out


def main():
    print('')
    print('🔗 Required-dep optional-chaining check')
    print('=' * 64)

    violations = []
    scanned = 0
    for dirpath, _dirs, files in os.walk(MODULES):
        for fn in sorted(files):
            if not fn.endswith('.js'):
                continue
            path = os.path.join(dirpath, fn)
            src = open(path, encoding='utf-8').read()
            req = required_deps(src)
            if not req:
                continue
            scanned += 1
            allowed = catch_ranges(src)
            starts = [0]
            for line in src.split('\n'):
                starts.append(starts[-1] + len(line) + 1)
            for dep in req:
                pat = re.compile(r"(?:this\.)?(?:deps|_deps)\.%s\?\." % re.escape(dep))
                for m in pat.finditer(src):
                    if any(a <= m.start() < b for a, b in allowed):
                        continue  # inside catch — see module docstring
                    line_no = next(i for i in range(len(starts) - 1)
                                   if starts[i] <= m.start() < starts[i + 1]) + 1
                    rel = os.path.relpath(path, os.path.join(MODULES, '..'))
                    violations.append((rel, line_no, dep))

    print('   scanned %d module(s) declaring required() deps' % scanned)
    print('')
    if violations:
        print('❌ FAIL — %d required dep(s) reached through optional chaining:' % len(violations))
        for rel, line_no, dep in violations:
            print('     %s:%d  →  %s' % (rel, line_no, dep))
        print('')
        print('   Drop the `?.`. A required dep that is missing must throw where it')
        print('   is used, naming itself — not no-op and take the feature with it.')
        print('   If it can legitimately be absent, declare it optional() instead.')
        return 1

    print('✅ PASS — every required dep is read unguarded.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
