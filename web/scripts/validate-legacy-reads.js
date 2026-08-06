#!/usr/bin/env node
/**
 * Legacy-read ratchet gate (review F-004).
 *
 * dataAccess.js is a legacy wrapper layer — its header says "new code should
 * use AppState.get()/update() directly; do not add new consumers" — but
 * loadMiniCycleData still has references across dozens of modules. This gate
 * makes the deprecation actually hold: the reference count may only go DOWN.
 *
 * Counts every line in web/modules/ and miniCycle-main.js that mentions
 * loadMiniCycleData (excluding core/dataAccess.js itself, which defines it,
 * and archive folders). Wiring lines and doc comments count too — that's
 * deliberate: retiring a consumer should also retire its wiring, and the
 * blunt count keeps the gate simple and ungameable.
 *
 * When you migrate a consumer, lower CEILING to the new count in the same
 * commit — the gate tells you the number.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reference count as of v2.369 (27 files). Lower this as consumers migrate.
const CEILING = 172;

const WEB = path.resolve(__dirname, '..');
const NEEDLE = 'loadMiniCycleData';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'archive' || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(path.join(WEB, 'modules'));
files.push(path.join(WEB, 'miniCycle-main.js'));

const perFile = new Map();
let total = 0;
for (const f of files) {
  const rel = path.relative(WEB, f).replace(/\\/g, '/');
  if (rel === 'modules/core/dataAccess.js') continue; // definition site
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const hits = lines.filter(l => l.includes(NEEDLE)).length;
  if (hits > 0) {
    perFile.set(rel, hits);
    total += hits;
  }
}

console.log(`🔎 legacy-read gate: ${total} ${NEEDLE} reference(s) across ${perFile.size} file(s) (ceiling: ${CEILING})`);

if (total > CEILING) {
  console.error('');
  console.error(`❌ Reference count ROSE above the ceiling (${total} > ${CEILING}).`);
  console.error(`   dataAccess.js is legacy — new code must use AppState.get()/update() directly.`);
  console.error('   Current consumers:');
  for (const [f, n] of [...perFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`     ${String(n).padStart(3)}  ${f}`);
  }
  process.exit(1);
}

if (total < CEILING) {
  // Failing here too makes the ratchet one-way: a pass at 171 with the
  // ceiling still at 172 would let a later change quietly restore a legacy
  // reference. Lowering CEILING in the same commit locks the progress in.
  console.error(`✂️  Count dropped below the ceiling — lower CEILING to ${total} in scripts/validate-legacy-reads.js in this same change to lock in the progress.`);
  process.exit(1);
}

console.log('✅ legacy-read gate passed');
