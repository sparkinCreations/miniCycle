#!/usr/bin/env node
/**
 * Label & History-Event Registry Validator
 *
 * Catches the string-registry rot class: code referencing a lookup table by a
 * key the table doesn't have. Two concrete diffs, both mechanical:
 *
 *   1. Every literal `getLabel('a.b.c')` key in shipped modules must resolve
 *      in DEFAULT_LABELS (to a string, or a {one, other} plural object).
 *      A miss is SILENT in production: labelResolver warns to console and
 *      returns the raw key as the user-facing string.
 *   2. Every event type passed to `logHistoryEvent('type', ...)` must have an
 *      entry in BOTH the icons and labels maps in historyManager.js — a miss
 *      renders 📌 + the raw type string in the history modal.
 *
 * Why this gate exists — Aug 2026 external review: three shipped string bugs
 * ('undo'/'redo' history types unmapped, a stale undo label, a pluralization
 * miss) all lived in the exact gap this closes; every validator to date
 * checked other registries (comments, docs, DI, built-ins) but nothing
 * checked the string tables. The reviewer's meta-finding held: every valid
 * finding was a mechanical diff of two lists — so this makes those two diffs
 * permanent. (During verification of that review, a hand-typed wrong category
 * name produced exactly the silent-fallback failure mode this gate catches.)
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   • Dynamic keys — getLabel(`x.${y}`) or getLabel(variable) — can't be
 *     resolved statically; they are COUNTED and reported, never gated.
 *   • Mapped-but-never-logged history types (e.g. cycle_reset) are a WARNING,
 *     not a failure: stored history events outlive the code that wrote them,
 *     so a map entry for a retired type still renders users' existing data.
 *     Removal buys nothing; absence of a LOGGED type's entry is the real bug.
 *   • LENS_SENSITIVE_KEYS are cross-checked as a bonus: a theme-overridable
 *     key that doesn't exist in DEFAULT_LABELS is a registry typo too.
 *
 * Usage: node scripts/validate-labels.js [--json]
 * Exit 1 on any unresolved key or unmapped logged type (gated at 0).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');

const { DEFAULT_LABELS, LENS_SENSITIVE_KEYS } = await import(
    path.join(WEB_ROOT, 'modules', 'labels', 'defaultLabels.js')
);

// ---------------------------------------------------------------------------
// Collect shipped module files (mirror of validate-es-builtins scope)
// ---------------------------------------------------------------------------

function collectFiles() {
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'testing') continue;
                walk(full);
            } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.tests.js')) {
                files.push(full);
            }
        }
    };
    walk(path.join(WEB_ROOT, 'modules'));
    return files;
}

// ---------------------------------------------------------------------------
// Diff 1: getLabel keys vs DEFAULT_LABELS
// ---------------------------------------------------------------------------

function resolveKey(key) {
    let node = DEFAULT_LABELS;
    for (const part of key.split('.')) {
        if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) {
            return false;
        }
        node = node[part];
    }
    // Three valid leaf shapes: plain string, {one, other} plural object, and
    // {touch, pointer} device-variant object (the gate's own first draft only
    // knew two of them — 12 false positives on its first run).
    return typeof node === 'string' ||
        (node !== null && typeof node === 'object' &&
            ('one' in node || 'other' in node || 'touch' in node || 'pointer' in node));
}

const files = collectFiles();
const unresolved = [];
let literalCount = 0;
let dynamicCount = 0;

const LITERAL_RE = /getLabel\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
const DYNAMIC_RE = /getLabel\(\s*(?:`|[a-zA-Z_$])/g;

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(WEB_ROOT, file);
    for (const m of src.matchAll(LITERAL_RE)) {
        literalCount++;
        if (!resolveKey(m[1])) {
            const line = src.slice(0, m.index).split('\n').length;
            unresolved.push({ file: rel, line, key: m[1] });
        }
    }
    dynamicCount += [...src.matchAll(DYNAMIC_RE)].length;
}

// Bonus: theme-overridable keys must exist in the base table
const badLensKeys = [...LENS_SENSITIVE_KEYS].filter(k => !resolveKey(k));

// ---------------------------------------------------------------------------
// Diff 2: logged history event types vs historyManager's icon/label maps
// ---------------------------------------------------------------------------

const loggedTypes = new Map(); // type -> first call site
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(WEB_ROOT, file);
    // (?:\?\.)? — DI call sites use `_deps.logHistoryEvent?.('type', ...)`;
    // the first draft's plain `logHistoryEvent(` regex missed every one of
    // them, which is precisely how 'undo'/'redo' stayed invisible.
    for (const m of src.matchAll(/logHistoryEvent(?:\?\.)?\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
        if (!loggedTypes.has(m[1])) {
            const line = src.slice(0, m.index).split('\n').length;
            loggedTypes.set(m[1], `${rel}:${line}`);
        }
    }
}

const historySrc = fs.readFileSync(path.join(WEB_ROOT, 'modules', 'features', 'historyManager.js'), 'utf8');
// The two registries are object literals whose keys are quoted event types.
function extractMapKeys(anchor) {
    const idx = historySrc.indexOf(anchor);
    if (idx === -1) return null;
    const open = historySrc.indexOf('{', idx);
    let depth = 0, end = open;
    for (let i = open; i < historySrc.length; i++) {
        if (historySrc[i] === '{') depth++;
        else if (historySrc[i] === '}' && --depth === 0) { end = i; break; }
    }
    const body = historySrc.slice(open, end);
    return new Set([...body.matchAll(/['"]([a-zA-Z0-9_]+)['"]\s*:/g)].map(m => m[1]));
}

const iconKeys = extractMapKeys('const icons =');
const labelKeys = extractMapKeys('const labels =');
const unmappedTypes = [];
const deadMapEntries = [];
if (iconKeys && labelKeys) {
    for (const [type, site] of loggedTypes) {
        const missing = [!iconKeys.has(type) && 'icons', !labelKeys.has(type) && 'labels'].filter(Boolean);
        if (missing.length) unmappedTypes.push({ type, site, missing: missing.join('+') });
    }
    for (const key of new Set([...iconKeys, ...labelKeys])) {
        if (!loggedTypes.has(key)) deadMapEntries.push(key);
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const failures = unresolved.length + unmappedTypes.length + badLensKeys.length;

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ failures, unresolved, unmappedTypes, badLensKeys, deadMapEntries, literalCount, dynamicCount }, null, 2));
    process.exit(failures > 0 ? 1 : 0);
}

console.log(`\n🏷️  LABEL & HISTORY-EVENT REGISTRY CHECK`);
console.log(`   ${literalCount} literal getLabel keys across ${files.length} modules | ${dynamicCount} dynamic calls (reported, not gated)`);
console.log(`   ${loggedTypes.size} logged history event types vs ${iconKeys?.size ?? '?'} icon / ${labelKeys?.size ?? '?'} label map entries\n`);

if (failures === 0) {
    console.log('✅ PASS — every label key resolves; every logged history type is mapped.');
} else {
    console.log(`❌ ${failures} registry mismatch(es) — GATED, must be 0\n`);
    for (const u of unresolved) console.log(`   ${u.file}:${u.line}\n      getLabel('${u.key}') — key does not resolve in DEFAULT_LABELS (renders the raw key)`);
    for (const t of unmappedTypes) console.log(`   ${t.site}\n      logHistoryEvent('${t.type}') — missing from ${t.missing} map(s) in historyManager.js (renders 📌 + raw type)`);
    for (const k of badLensKeys) console.log(`   LENS_SENSITIVE_KEYS: '${k}' — theme-overridable key missing from DEFAULT_LABELS`);
}
if (deadMapEntries.length) {
    console.log(`\n   ℹ️  mapped but never logged (kept on purpose — stored events outlive their writers): ${deadMapEntries.join(', ')}`);
}
console.log('');
process.exit(failures > 0 ? 1 : 0);
