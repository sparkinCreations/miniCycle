#!/usr/bin/env python3
"""Regression tests for generate_restore_script.py — the release's undo button.

WHY THESE EXIST: restore.sh is written during every release and read only during
an emergency. Until this suite, nothing had ever *executed* one. Its defining bug
is on record and is exactly the kind that stays invisible: an earlier version
resolved paths with "../$file" — ONE level up — so a restore wrote into
<web>/backup/ and the real files were never recovered. You find that out while
trying to undo a bad release.

So these tests do not inspect the generated text and call it a day. Most of them
BUILD a throwaway web root, put a backup folder inside it, run the generated
restore.sh for real with bash, and assert on where the bytes landed.

Usage: python3 scripts/test-generate-restore-script.py   (exit 0 = all pass)
"""

import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_restore_script as gen  # noqa: E402

PASS = 0
FAIL = 0


def ok(name):
    global PASS
    print("   \033[32m✅\033[0m %s" % name)
    PASS += 1


def fail(name, detail):
    global FAIL
    print("   \033[31m❌ %s\033[0m" % name)
    print("      %s" % detail)
    FAIL += 1


def check(name, condition, detail=''):
    ok(name) if condition else fail(name, detail)


def make_tree(files, backup_name='version_update_20260825_000000'):
    """A throwaway <root>/ with <root>/backup/<backup_name>/ holding `files`.

    Mirrors production layout exactly, because the two-levels-up resolution is
    the thing under test: restore.sh lives at <root>/backup/<stamp>/restore.sh.
    """
    root = tempfile.mkdtemp()
    backup = os.path.join(root, 'backup', backup_name)
    os.makedirs(backup, exist_ok=True)
    for rel, body in files.items():
        path = os.path.join(backup, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as fh:
            fh.write(body)
    return root, backup


def write_script(backup, paths):
    out = os.path.join(backup, 'restore.sh')
    with open(out, 'w') as fh:
        fh.write(gen.render(paths))
    os.chmod(out, 0o755)
    return out


def run(script, cwd):
    return subprocess.run(['bash', script], cwd=cwd, capture_output=True, text=True)


print("\n\033[34m%s\033[0m" % ("=" * 66))
print("\033[34m♻️  generate_restore_script regression tests\033[0m")
print("\033[34m%s\033[0m" % ("=" * 66))

# ---------------------------------------------------------------------------
print("\n\033[36m▸ the script it generates is valid shell\033[0m")

text = gen.render(['version.js', 'service-worker.js'])
root, backup = make_tree({})
probe = os.path.join(backup, 'syntax-probe.sh')
open(probe, 'w').write(text)
syn = subprocess.run(['bash', '-n', probe], capture_output=True, text=True)
check('generated script passes `bash -n`', syn.returncode == 0, syn.stderr.strip())
check('generated script is a bash script', text.startswith('#!/bin/bash'))
check('generated script uses strict mode', 'set -euo pipefail' in text)

# ---------------------------------------------------------------------------
print("\n\033[36m▸ path resolution — the bug this stage is famous for\033[0m")

# THE regression. restore.sh sits at <root>/backup/<stamp>/. The web root is TWO
# levels up. "../$file" (one level) silently restored into <root>/backup/.
root, backup = make_tree({'version.js': 'RESTORED', 'service-worker.js': 'SW'})
open(os.path.join(root, 'version.js'), 'w').write('STALE')
script = write_script(backup, ['version.js', 'service-worker.js'])
res = run(script, cwd=root)

restored = open(os.path.join(root, 'version.js')).read()
check('restores into the WEB ROOT, two levels up', restored == 'RESTORED',
      'version.js contains %r (rc=%d) %s' % (restored, res.returncode, res.stderr[:120]))
check('does NOT write into the backup dir itself',
      not os.path.exists(os.path.join(root, 'backup', 'version.js')),
      'a copy landed in backup/ — this is the one-level-up bug')

# The whole reason SCRIPT_DIR is derived rather than assumed.
root, backup = make_tree({'version.js': 'FROM-ANYWHERE'})
script = write_script(backup, ['version.js'])
elsewhere = tempfile.mkdtemp()
res = run(script, cwd=elsewhere)
check('works when run from an unrelated cwd',
      open(os.path.join(root, 'version.js')).read() == 'FROM-ANYWHERE',
      'rc=%d %s' % (res.returncode, res.stderr[:120]))

# ---------------------------------------------------------------------------
print("\n\033[36m▸ behaviour under real conditions\033[0m")

# Nested targets: docs/PROJECT_STATS.md is in every release's list.
root, backup = make_tree({'docs/PROJECT_STATS.md': 'STATS'})
script = write_script(backup, ['docs/PROJECT_STATS.md'])
res = run(script, cwd=root)
check('creates missing parent directories',
      os.path.exists(os.path.join(root, 'docs', 'PROJECT_STATS.md')),
      'rc=%d %s' % (res.returncode, res.stderr[:160]))

# A --lite-only run backs up only some of the listed files. Under `set -e` a
# naive implementation would abort on the first absent one and silently restore
# nothing after it.
root, backup = make_tree({'version.js': 'V'})
script = write_script(backup, ['manifest-lite.json', 'version.js', 'nope.css'])
res = run(script, cwd=root)
check('absent files are skipped, and later files still restore',
      res.returncode == 0 and open(os.path.join(root, 'version.js')).read() == 'V',
      'rc=%d stderr=%s' % (res.returncode, res.stderr[:160]))
check('summary counts only what was actually restored',
      'Restored: 1' in res.stdout, res.stdout[-200:])

# ---------------------------------------------------------------------------
print("\n\033[36m▸ the file list\033[0m")

lines = gen.restore_lines(['a.js', 'b.js', 'a.js', '  ', 'c.js', 'b.js'])
check('duplicates are dropped', len(lines) == 3, lines)
check('original order is preserved',
      lines == ['restore_file "a.js"', 'restore_file "b.js"', 'restore_file "c.js"'], lines)
check('blank entries are ignored', all(l != 'restore_file ""' for l in lines), lines)

# The path is interpolated into a double-quoted shell string; a quote in it would
# break out. Refuse rather than emit a script that does something else.
try:
    gen.restore_lines(['ok.js', 'evil".js'])
    fail('a double quote in a path is refused', 'no error raised')
except ValueError:
    ok('a double quote in a path is refused')

empty = gen.render([])
open(probe, 'w').write(empty)
check('an empty list still yields a runnable script',
      subprocess.run(['bash', '-n', probe], capture_output=True).returncode == 0)

# ---------------------------------------------------------------------------
print("\n\033[36m▸ CLI\033[0m")

root, backup = make_tree({'version.js': 'CLI'})
out = os.path.join(backup, 'restore.sh')
proc = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                    'generate_restore_script.py'),
                       '--out', out],
                      input='version.js\nservice-worker.js\n', capture_output=True, text=True)
check('CLI writes the script', proc.returncode == 0 and os.path.exists(out), proc.stderr[:160])
check('CLI marks it executable', os.access(out, os.X_OK))
check('CLI reports the file count', '2 file(s)' in proc.stdout, proc.stdout.strip())

res = run(out, cwd=root)
check('the CLI-generated script actually restores',
      open(os.path.join(root, 'version.js')).read() == 'CLI',
      'rc=%d %s' % (res.returncode, res.stderr[:160]))

# ---------------------------------------------------------------------------
print("\n\033[34m%s\033[0m" % ("=" * 66))
if FAIL == 0:
    print("\033[32m🎉 All %d generate_restore_script tests passed.\033[0m" % PASS)
    print("\033[34m%s\033[0m\n" % ("=" * 66))
    raise SystemExit(0)
print("\033[31m⚠️  %d passed, %d failed.\033[0m" % (PASS, FAIL))
print("\033[34m%s\033[0m\n" % ("=" * 66))
raise SystemExit(1)
