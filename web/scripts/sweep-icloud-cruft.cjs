#!/usr/bin/env node
/**
 * iCloud Duplicate Cruft Sweeper
 *
 * The repo lives under ~/Documents, which iCloud syncs — and iCloud resolves
 * sync conflicts by minting "<name> 2.<ext>" / "<name> 2" duplicates next to
 * the original. These are never wanted here, and they are not harmless:
 *
 *   • Jul 2026 (v2.273): a stray "assets 2/" inside mobile/android/www/ made
 *     build-android-www.cjs's fs.rmSync throw ENOTEMPTY. The stage is
 *     non-fatal by design, so the release continued and produced an APK whose
 *     versionName said X while its payload was X-1 — with git status clean,
 *     because the payload dirs are gitignored.
 *   • Aug 2026: a full-repo sweep removed 32 duplicate directories and 149
 *     duplicate files that had accumulated across chrome/full/, web/dist/,
 *     and both mobile payload trees.
 *   • "web/package 2.json" once reached a commit via `git add <dir>/` — which
 *     is why the repo rule is `git add -u` (see CLAUDE.md / memory).
 *
 * SAFETY MODEL — a candidate is deleted ONLY when:
 *   1. its name matches /^(.*) [2-9](\.ext)?$/ (macOS duplicate naming), AND
 *   2. the original sibling ("<name>" / "<name>.<ext>") EXISTS beside it.
 * Anything matching the name pattern without an original stays put and is
 * reported instead — a legit filename like "Schema updated version 3.txt"
 * survives on rule 2 even before the archive exclusion applies. Note the
 * regex anchors the digit as the FINAL token: timestamped names like
 * "Screenshot ... at 8.23.04 AM.png" never match at all.
 *
 * NEVER touches: .git, node_modules, web/archive, web/docs/archive (archives
 * are historical snapshots and may legitimately contain "guide 2.0.txt"-style
 * names; repo rule: never modify archives).
 *
 * Usage:
 *   node scripts/sweep-icloud-cruft.cjs           # sweep + report
 *   node scripts/sweep-icloud-cruft.cjs --dry-run # report only, delete nothing
 *
 * Wired into update-version.sh before the platform build stages so payload
 * rebuilds can't hit the ENOTEMPTY class again. Exit 0 always (a sweep that
 * finds nothing is a success, and set -e in the release script must not die
 * here); exits 1 only on --dry-run WITH findings, so it can double as a check.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

const EXCLUDED = new Set(['\.git', 'node_modules'].map(String));
const EXCLUDED_PATHS = [
    path.join(REPO_ROOT, 'web', 'archive'),
    path.join(REPO_ROOT, 'web', 'docs', 'archive')
];

// "<base> N" or "<base> N.<ext>" where N is the FINAL token (2-9).
const DUP_RE = /^(.*) [2-9](\.[^./]+)?$/;

let deletedDirs = 0, deletedFiles = 0;
const kept = [];

function originalFor(name) {
    const m = DUP_RE.exec(name);
    if (!m) return null;
    return m[1] + (m[2] || '');
}

function sweep(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === 'node_modules') continue;
            if (EXCLUDED_PATHS.some(p => full === p)) continue;
            const orig = originalFor(entry.name);
            if (orig && fs.existsSync(path.join(dir, orig))) {
                if (!DRY_RUN) fs.rmSync(full, { recursive: true, force: true });
                deletedDirs++;
                continue;
            }
            if (orig) kept.push(full);
            sweep(full);
        } else {
            const orig = originalFor(entry.name);
            if (orig && fs.existsSync(path.join(dir, orig))) {
                if (!DRY_RUN) fs.rmSync(full, { force: true });
                deletedFiles++;
            } else if (orig) {
                kept.push(full);
            }
        }
    }
}

sweep(REPO_ROOT);

const verb = DRY_RUN ? 'would delete' : 'deleted';
if (deletedDirs + deletedFiles === 0) {
    console.log('🧹 [sweep-icloud-cruft] clean — no iCloud duplicates found');
} else {
    console.log(`🧹 [sweep-icloud-cruft] ${verb} ${deletedDirs} duplicate dir(s), ${deletedFiles} duplicate file(s)`);
}
if (kept.length) {
    console.log(`   left in place (name matches but no original sibling — likely legit):`);
    for (const k of kept.slice(0, 8)) console.log(`     ${path.relative(REPO_ROOT, k)}`);
}

process.exit(DRY_RUN && (deletedDirs + deletedFiles) > 0 ? 1 : 0);
