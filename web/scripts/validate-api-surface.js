#!/usr/bin/env node
/**
 * validate-api-surface — appContext API reads must resolve.
 *
 * WHY THIS EXISTS
 * featureBoot.js builds each grouped API (`uiApiObj`, `cycleApiObj`, …) as a
 * hand-written allow-list and hands it to appContextMod.registerApi(). A module
 * method reaches that surface ONLY if someone remembers to name it there. Miss
 * it and `getUiApi()?.thing?.()` is undefined — the optional chain swallows it,
 * the feature silently does nothing, and NOTHING warns, because the manifest
 * side succeeded: the method really is on deps.ui.
 *
 * That failure hit three times in one working session — routineManager's
 * helpWindowManager, the mode-help refresh, and applyMenuSectionOpenState —
 * each costing a debugging detour that ended at the same missing line.
 *
 * WHAT IS CHECKED
 * Every `get<Name>Api()?.member` read across modules/ must be a key of the
 * object registered under that api name. This is the exact invariant that
 * broke; checking manifests against the allow-list instead would flood the
 * output, because plenty of `provides` are consumed via deps.<category> and
 * were never meant to be on the appContext surface.
 *
 * Comments and strings are stripped first: uiBoot.js carries a comment naming
 * `getUiApi().showLoader`, which is prose about the wiring, not a call.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEB = path.resolve(__dirname, '..');
const FEATURE_BOOT = path.join(WEB, 'modules/boot/featureBoot.js');

/** Strip // line comments, block comments and string/template literals. */
function stripNonCode(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') {
            const q = c; i++;
            while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
            i++; out += '""'; continue;
        }
        out += c; i++;
    }
    return out;
}

/** Top-level keys of the object literal starting at the `{` at `open`. */
function topLevelKeys(src, open) {
    const keys = [];
    let depth = 0, i = open;
    let atKeyPos = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{' || c === '[' || c === '(') { depth++; if (depth === 1) atKeyPos = true; continue; }
        if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) break; continue; }
        if (depth === 1 && c === ',') { atKeyPos = true; continue; }
        if (depth === 1 && atKeyPos && /[A-Za-z_$]/.test(c)) {
            let j = i;
            while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
            const word = src.slice(i, j);
            // A key is followed by ':' (pair) or ',' / '}' (shorthand).
            const rest = src.slice(j).match(/^\s*([:,}])/);
            if (rest) keys.push(word);
            atKeyPos = false;
            i = j - 1;
            continue;
        }
        if (depth === 1 && !/\s/.test(c)) atKeyPos = false;
    }
    return keys;
}

// ── 1. registered API surfaces ────────────────────────────────────────────
const bootSrc = stripNonCode(fs.readFileSync(FEATURE_BOOT, 'utf8'));
const surfaces = new Map();   // api name -> Set(keys)
const objVarKeys = new Map(); // variable name -> Set(keys)

for (const m of bootSrc.matchAll(/\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*\{/g)) {
    objVarKeys.set(m[1], new Set(topLevelKeys(bootSrc, m.index + m[0].length - 1)));
}
// registerApi()'s first argument is a string literal, which stripNonCode blanks,
// so the api NAMES are read from the unstripped source. Keys still come from the
// stripped copy, where a string value cannot be mistaken for a key.
const bootRaw = fs.readFileSync(FEATURE_BOOT, 'utf8');
for (const m of bootRaw.matchAll(/registerApi\(\s*['"]([a-zA-Z]+)['"]\s*,\s*([A-Za-z0-9_$]+)\s*\)/g)) {
    const [, apiName, varName] = m;
    if (objVarKeys.has(varName)) surfaces.set(apiName, objVarKeys.get(varName));
}

if (surfaces.size === 0) {
    console.error('❌ FAIL — found no registerApi() surfaces in featureBoot.js.');
    console.error('   The parser is out of step with the file; fix this script before trusting it.');
    process.exit(1);
}

// ── 2. every get<Name>Api()?.member read ──────────────────────────────────
function walk(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'archive' || e.name === 'node_modules') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (e.name.endsWith('.js')) acc.push(p);
    }
    return acc;
}

const violations = [];
let reads = 0;
for (const file of walk(path.join(WEB, 'modules'))) {
    const src = stripNonCode(fs.readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/get([A-Z][A-Za-z0-9_$]*)Api\(\)\s*\??\.\s*([A-Za-z0-9_$]+)/g)) {
        const apiName = m[1].toLowerCase();
        const member = m[2];
        if (!surfaces.has(apiName)) continue;   // not an appContext surface
        reads++;
        if (!surfaces.get(apiName).has(member)) {
            const line = src.slice(0, m.index).split('\n').length;
            violations.push({ file: path.relative(WEB, file), line, apiName, member });
        }
    }
}

console.log('🔌 appContext API surface — reads must resolve\n');
for (const [name, keys] of [...surfaces].sort()) {
    console.log(`   ${String(keys.size).padStart(3)} key(s)  ${name}Api`);
}
console.log(`\n   ${reads} read site(s) checked across modules/\n`);

if (violations.length === 0) {
    console.log('✅ PASS — every get*Api() read resolves to a registered key.');
    process.exit(0);
}

console.log(`❌ FAIL — ${violations.length} read(s) reach a key no API registers:\n`);
for (const v of violations) {
    console.log(`   ${v.file}:${v.line}`);
    console.log(`      get${v.apiName[0].toUpperCase()}${v.apiName.slice(1)}Api()?.${v.member}  →  not a key of ${v.apiName}ApiObj`);
    console.log(`      Add it to ${v.apiName}ApiObj in modules/boot/featureBoot.js.`);
    console.log('      (Declaring it in the manifest is NOT enough — that object is a separate allow-list.)\n');
}
process.exit(1);
