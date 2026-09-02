#!/usr/bin/env node
/**
 * Factory-reset storage-key coverage gate.
 *
 * The factory reset removes localStorage keys two ways: an explicit
 * `legacyKeysToRemove` list, and a dynamic sweep that deletes anything whose
 * name contains "minicycle" or "taskcycle". Every key the app defines must be
 * caught by one of them — or be deliberately preserved.
 *
 * Nothing enforced that, and the failure is silent in the worst direction: a
 * new key that does NOT carry the app's own name survives a reset the user was
 * told deleted everything. There is no error, no warning, and the reset still
 * reports success — the data is simply still there on the next load.
 *
 * This is not hypothetical. backupRestoreManager.js carries the comment
 * "Add new plugin keys HERE" above STORAGE_KEYS.TIME_TRACKER precisely because
 * pluginIntegrationGuide.js tells plugin authors to name keys like
 * `timeTrackerData` — no "miniCycle" anywhere in it. That instruction plus an
 * unguarded list is a standing invitation to add key #26 and never notice.
 *
 * Coverage means one of:
 *   DYNAMIC    the key matches the sweep's substring rule (checked against the
 *              substrings read out of the source, not a copy of them, so
 *              changing the rule changes this gate too)
 *   EXPLICIT   the key is named in legacyKeysToRemove, literally or as
 *              STORAGE_KEYS.NAME
 *   PRESERVED  the key is in PRESERVED_KEYS below, with the reason it survives
 *
 * Gated at ZERO uncovered. A new key fails until it is swept or justified.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STORAGE_KEYS } from '../modules/core/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESET_FILE = path.resolve(__dirname, '../modules/ui/backupRestoreManager.js');
const src = fs.readFileSync(RESET_FILE, 'utf8');

/**
 * Keys the factory reset intentionally does NOT delete. Each needs a reason
 * that survives review — "it's fine" is not one.
 */
const PRESERVED_KEYS = new Map([
    ['FORCE_FULL_VERSION',
     'A DEVICE decision, not user data. Wiping it sent anyone who had opted out ' +
     'of Lite back to Lite on their next load — a one-way door, since returning ' +
     'needs a ?mode=full URL they have no way to discover. The reset reads it ' +
     'before the sweep and writes it back after.'],
]);

// --- Read the sweep's substring rule out of the source ------------------------
// e.g. `keyLower.includes('minicycle') || keyLower.includes('taskcycle')`
const sweepMatches = [...src.matchAll(/keyLower\.includes\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
if (!sweepMatches.length) {
    console.error('❌ Could not find the dynamic key sweep (keyLower.includes(...)) in');
    console.error(`   ${path.relative(process.cwd(), RESET_FILE)}`);
    console.error('   The sweep moved or was renamed — update this gate to match, do not delete it.');
    process.exit(1);
}

// --- Read the explicit removal list -------------------------------------------
const listMatch = src.match(/const legacyKeysToRemove = \[([\s\S]*?)\];/);
if (!listMatch) {
    console.error('❌ Could not find legacyKeysToRemove in the reset. Update this gate to match.');
    process.exit(1);
}
const listBody = listMatch[1];
const explicitLiterals = new Set([...listBody.matchAll(/["']([^"']+)["']/g)].map(m => m[1]));
const explicitRefs = new Set([...listBody.matchAll(/STORAGE_KEYS\.([A-Z0-9_]+)/g)].map(m => m[1]));

// --- Classify every declared key ----------------------------------------------
const uncovered = [];
const covered = { DYNAMIC: 0, EXPLICIT: 0, PRESERVED: 0 };

for (const [name, value] of Object.entries(STORAGE_KEYS)) {
    if (PRESERVED_KEYS.has(name)) { covered.PRESERVED++; continue; }
    const lower = String(value).toLowerCase();
    if (sweepMatches.some(sub => lower.includes(sub.toLowerCase()))) { covered.DYNAMIC++; continue; }
    if (explicitLiterals.has(value) || explicitRefs.has(name)) { covered.EXPLICIT++; continue; }
    uncovered.push({ name, value });
}

// --- Stale preserved entries ---------------------------------------------------
const stalePreserved = [...PRESERVED_KEYS.keys()].filter(n => !(n in STORAGE_KEYS));

console.log(`🔎 factory-reset coverage: ${Object.keys(STORAGE_KEYS).length} storage key(s) — ` +
            `${covered.DYNAMIC} swept, ${covered.EXPLICIT} listed, ${covered.PRESERVED} preserved, ` +
            `${uncovered.length} uncovered`);
console.log(`   sweep matches on: ${sweepMatches.map(s => `"${s}"`).join(', ')}`);

let failed = false;

if (uncovered.length) {
    console.error('');
    console.error(`❌ ${uncovered.length} storage key(s) would SURVIVE a factory reset:`);
    uncovered.forEach(k => console.error(`     STORAGE_KEYS.${k.name}  →  '${k.value}'`));
    console.error('');
    console.error('   The reset tells the user it deleted everything, so a survivor is a');
    console.error('   silent lie — no error, no warning, the data is just still there.');
    console.error('   Fix by ONE of:');
    console.error('     • add the key to legacyKeysToRemove in backupRestoreManager.js');
    console.error('     • give it a name containing "miniCycle" so the sweep catches it');
    console.error('     • add it to PRESERVED_KEYS in this script WITH the reason it must survive');
    failed = true;
}

if (stalePreserved.length) {
    console.error('');
    console.error('✂️  PRESERVED_KEYS names a key that no longer exists in STORAGE_KEYS:');
    stalePreserved.forEach(n => console.error(`     ${n}`));
    console.error('   Remove it here in the same change, or it silently excuses a future key.');
    failed = true;
}

if (failed) process.exit(1);

console.log('✅ PASS — every storage key is swept, listed, or deliberately preserved.');
