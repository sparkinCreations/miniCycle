#!/usr/bin/env node
/**
 * validate-duplicate-keys.js — no object literal in shipped code may define the
 * same key twice.
 *
 * WHY THIS GATE EXISTS
 * --------------------
 * A duplicate key is not a syntax error and not a lint error. The later
 * definition silently wins and the earlier one becomes dead code. Nothing warns
 * at runtime, and every other gate passes: `validate:labels` checks that keys
 * RESOLVE, and a shadowed key resolves fine — just to the wrong string.
 *
 * Measured Sep 2026, against v2.539. `defaultLabels.js` defined
 * `notify.reminderEnabled` twice:
 *
 *     line 684:  'Reminder enabled: {settings}'      <- dead
 *     line 879:  'Task reminders enabled!'           <- won
 *
 * `reminders.js` computes the schedule ("every 2 hours") and passes it as
 * `{settings}`. The winning definition has no placeholder, so the schedule was
 * silently dropped: a user enabling reminders on a task was told they were on
 * and never told when. Two labels written for two contexts, collapsed into one
 * by a duplicate key, shipping wrong for months.
 *
 * esbuild already detects this — it emits `duplicate-object-key` warnings during
 * every build. But they are three lines inside a hundred-line build log that
 * ends "dist/ ready", so nobody reads them. This turns that warning into a gate.
 *
 * Related fault line: CLAUDE.md #18 and REVIEW_PATTERNS.md §9 (bracket lookups
 * on name-keyed maps). Same family — a write that reads back fine and is wrong.
 *
 * Gated at 0. Usage:  npm run validate:keys
 */
import esbuild from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['modules'];
// Never scanned: historical snapshots, the frozen Lite fallback, build output,
// and dependencies. Duplicates there are not ours to fix.
const SKIP = /(^|\/)(node_modules|dist|build|backup|archive|lite)(\/|$)/i;

function collect(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full);
        if (SKIP.test(rel)) continue;
        if (entry.isDirectory()) collect(full, out);
        else if (entry.name.endsWith('.js')) out.push(rel);
    }
    return out;
}

(async () => {
    const files = SCAN_DIRS.flatMap(d => collect(path.join(ROOT, d)));

    let warnings = [];
    try {
        const result = await esbuild.build({
            entryPoints: files.map(f => path.join(ROOT, f)),
            bundle: false,
            write: false,
            logLevel: 'silent',
            outdir: path.join(os.tmpdir(), 'mc-dupkeys')
        });
        warnings = result.warnings || [];
    } catch (err) {
        // A parse error is a different failure and other gates own it, but this
        // gate must not report "clean" when it never actually looked.
        console.error(`❌ Could not parse the module tree, so nothing was checked:\n   ${err.message}`);
        process.exit(1);
    }

    const dupes = warnings.filter(w => w.id === 'duplicate-object-key');

    console.log(`\n🔑 Duplicate object keys — scanned ${files.length} module file(s)\n`);

    if (dupes.length === 0) {
        console.log('✅ PASS — no object literal defines the same key twice.\n');
        process.exit(0);
    }

    for (const w of dupes) {
        const loc = w.location;
        const note = (w.notes && w.notes[0] && w.notes[0].location) || null;
        console.log(`❌ ${loc.file}:${loc.line}  duplicate key`);
        if (note) {
            console.log(`     first  (line ${note.location ? note.location.line : note.line}): ${note.lineText.trim()}`);
        }
        console.log(`     second (line ${loc.line}): ${loc.lineText.trim()}   <- this one WINS`);
        console.log('');
    }

    console.log(`❌ FAIL — ${dupes.length} duplicate key(s). The later definition silently wins and the`);
    console.log('   earlier one is dead code. Decide which is correct, then rename or delete the other —');
    console.log('   do not leave both. If two call sites genuinely need different text, they need');
    console.log('   different keys (see notify.reminderEnabled / reminderEnabledWithSettings).\n');
    process.exit(1);
})();
