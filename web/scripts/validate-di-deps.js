#!/usr/bin/env node
/**
 * DI Dependency Declaration Validator
 *
 * Catches the "used-but-undeclared" silent sub-class that the boot-time
 * WARN_ON_UNMAPPED_DECLARED_DEPS flag cannot see: a dependency accessed via
 * `this.deps.X` / `_deps.X` that the module never declares in its manifest
 * (requires / optionalDeps / lazyRequires).
 *
 * Under the default loader, the broad `Object.assign(result, depMappings)`
 * injects every dep regardless of declarations, so the access "works" — until
 * ENFORCE_REQUIRES flips on, the broad assign is skipped, and the access either
 * silently no-ops (guarded with `?.`) or THROWS (called directly). The WARN
 * flag only iterates manifest-declared deps, so a never-declared one is invisible
 * to it; this static check closes that gap. See:
 *   docs/future-work/ENFORCE_REQUIRES_ROLLOUT_PLAN.md
 *   docs/future-work/AUTO_GENERATED_DEPMAPPINGS_PLAN.md
 *
 * Findings are split by confidence:
 *   🔴 used-but-undeclared  — real dep, accessed, missing from this manifest
 *   🟠 facade forward-through — same, but in a facade that forwards to sub-modules
 *   🟡 declared-but-unused  — dead declaration (lower confidence; parse may miss
 *                             exotic access forms, and facades forward deps they
 *                             never touch directly)
 *   ⚪ resolvable-nowhere   — accessed but provided by no manifest/depMappings/core
 *                             (a dead DI-contract dep whose fallback always runs,
 *                             or a local property the parse caught)
 *
 * Manifest-driven: only files with a MODULE_MANIFESTS entry are scanned. Facade
 * sub-modules (no manifest, wired via wireSubModuleDependencies) are out of scope,
 * except those listed in FACADE_SUB_FILES, whose manager-back-reference accesses
 * count toward the owning facade's usage.
 *
 * Usage:
 *   node scripts/validate-di-deps.js          # human report
 *   node scripts/validate-di-deps.js --json    # machine-readable
 *
 * Exit 1 (gated) if: any 🔴 used-but-undeclared, any ⚪ resolvable-nowhere not
 * covered by RUNTIME_WIRED, or 🟡 declared-but-unused exceeds UNUSED_BASELINE
 * (ratchet — may only go down). 🟠 facade forward-through remains advisory.
 *
 * @version 1.1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const bootDir = path.join(webRoot, 'modules', 'boot');

const JSON_OUT = process.argv.includes('--json');

// The facade modules dynamically import sub-modules and forward their deps to
// them, so they legitimately touch deps they only pass through. Reported apart
// from the simple-module findings to keep the high-confidence list clean.
const FACADES = new Set(['settingsManager', 'taskCore', 'taskDOM', 'preferencesManager', 'statsPanel']);

// Facade sub-modules that reach the facade's deps through a manager back-
// reference (`this.m.dependencies.X` / `this.m.rawDeps.X`) instead of their
// own this.deps. Scanned as part of the facade's usage surface so deps used
// only from a sub-module don't read as dead. Paths are bootDir-relative,
// like manifest paths. (The 4 older facades wire sub-modules their own way —
// add them here only when their access shape is machine-recognizable.)
const FACADE_SUB_FILES = {
    statsPanel: [
        '../features/statsPanelGestures.js',
        '../features/statsPanelRewards.js',
    ],
};

/** Collect dep names a facade sub-module reaches via its manager back-reference. */
function collectSubModuleAccessed(src) {
    const found = new Set();
    for (const m of src.matchAll(/this\.m\.(?:dependencies|rawDeps)\??\.([A-Za-z$][\w$]*)/g)) {
        if (!m[1].startsWith('_')) found.add(m[1]);
    }
    return found;
}

// Deps wired at RUNTIME outside the loader (no manifest/depMappings route), so
// the static scan can't see their provider. Every entry must name the wiring
// call site. Adding here requires that call site to actually exist — this is an
// exemption list, not a mute button.
//   consoleCapture:appendToTestResults — wired by testing-modal-debug.js
//     setupConsoleCaptureButtons() via consoleCapture.setTestResultsAppender()
//     (instance method; a static import there would split the module under ?v=).
const RUNTIME_WIRED = new Set([
    'consoleCapture:appendToTestResults',
]);

// Ratchet baseline for 🟡 declared-but-unused: the count may go DOWN freely but
// any increase fails the run. Lower this number whenever cleanup shrinks it —
// never raise it to make a failure go away without a removal elsewhere.
const UNUSED_BASELINE = 99;

const { MODULE_MANIFESTS, CORE_DEPS } = await import(
    pathToFileURL(path.join(bootDir, 'moduleManifests.js')).href
);
const core = CORE_DEPS instanceof Set ? CORE_DEPS : new Set(CORE_DEPS || []);

/**
 * Build the "known dep universe": every name that is a real DI dependency
 * somewhere. An access whose name is NOT in here can't resolve through the
 * loader at all — it's a dead contract dep or a local property, not a DI gap.
 */
function buildKnownDeps() {
    const known = new Set(core);
    for (const m of Object.values(MODULE_MANIFESTS)) {
        for (const n of m.provides || []) known.add(n);
        if (m.provideInstance) known.add(m.provideInstance);
        for (const n of m.requires || []) known.add(n);
        for (const n of m.optionalDeps || []) known.add(n);
        for (const n of m.lazyRequires || []) known.add(n);
    }
    // Fold in depMappings keys — many real deps are mappable there without
    // appearing in any manifest `provides` (e.g. forwarded sub-module funcs).
    // Parsed, not eval'd: we only need the top-level key names.
    try {
        const loaderSrc = fs.readFileSync(path.join(bootDir, 'moduleLoader.js'), 'utf8');
        const start = loaderSrc.indexOf('const depMappings = {');
        const end = loaderSrc.indexOf('\n    };', start);
        if (start !== -1 && end !== -1) {
            for (const m of loaderSrc.slice(start, end).matchAll(/^        ([A-Za-z_$][\w$]*):/gm)) {
                known.add(m[1]);
            }
        }
    } catch {
        // loader not found — universe falls back to manifests only
    }
    return known;
}

/** Strip comments so a `this.deps.X` mentioned in a doc-comment isn't counted. */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')       // block comments
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');  // line comments (preserve http://)
}

/** Collect every dep name accessed off this.deps / _deps (member, destructure, alias). */
function collectAccessed(src) {
    const found = new Set();
    const add = (n) => { if (n && !n.startsWith('_')) found.add(n); };

    // member access: this.deps.NAME / this.deps?.NAME / _deps.NAME
    for (const m of src.matchAll(/this\.deps\??\.([A-Za-z$][\w$]*)/g)) add(m[1]);
    for (const m of src.matchAll(/(?<![\w.$])_deps\.([A-Za-z$][\w$]*)/g)) add(m[1]);

    // destructure off this.deps / _deps:  const { a, b: c, d = x } = this.deps
    for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:this\.deps|_deps)\b/g)) {
        for (const part of m[1].split(',')) add(part.trim().split(/[:=]/)[0].trim());
    }

    // aliasing: const ALIAS = this.deps;  then ALIAS.NAME / destructure off ALIAS
    for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z$][\w$]*)\s*=\s*this\.deps\s*;/g)) {
        const alias = m[1];
        if (alias === 'deps' || alias.toLowerCase().includes('dep')) {
            const memberRe = new RegExp(`(?<![\\w.$])${alias}\\.([A-Za-z$][\\w$]*)`, 'g');
            for (const mm of src.matchAll(memberRe)) add(mm[1]);
            const destrRe = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*${alias}\\b`, 'g');
            for (const mm of src.matchAll(destrRe)) {
                for (const part of mm[1].split(',')) add(part.trim().split(/[:=]/)[0].trim());
            }
        }
    }
    return found;
}

const known = buildKnownDeps();
const results = [];
const scanFailures = [];

for (const [name, manifest] of Object.entries(MODULE_MANIFESTS)) {
    if (!manifest || !manifest.path) continue;
    const filePath = path.resolve(bootDir, manifest.path);
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        scanFailures.push({ name, path: manifest.path, error: e.code || String(e) });
        continue;
    }
    const src = stripComments(raw);

    const declared = new Set([
        ...(manifest.requires || []),
        ...(manifest.optionalDeps || []),
        ...(manifest.lazyRequires || []),
    ]);
    const accessed = collectAccessed(src);

    // Fold in usage from facade sub-modules (deps reached via `this.m.…`).
    for (const subPath of FACADE_SUB_FILES[name] || []) {
        try {
            const subSrc = stripComments(fs.readFileSync(path.resolve(bootDir, subPath), 'utf8'));
            for (const d of collectSubModuleAccessed(subSrc)) accessed.add(d);
        } catch (e) {
            scanFailures.push({ name: `${name} (sub: ${subPath})`, path: subPath, error: e.code || String(e) });
        }
    }

    const usedButUndeclared = [...accessed]
        .filter(d => !declared.has(d) && !core.has(d) && known.has(d)).sort();
    const resolvableNowhere = [...accessed]
        .filter(d => !declared.has(d) && !core.has(d) && !known.has(d)
            && !RUNTIME_WIRED.has(`${name}:${d}`)).sort();
    const declaredButUnused = [...declared]
        .filter(d => !accessed.has(d) && !core.has(d)).sort();

    if (usedButUndeclared.length || declaredButUnused.length || resolvableNowhere.length) {
        results.push({
            name, path: manifest.path, facade: FACADES.has(name),
            usedButUndeclared, declaredButUnused, resolvableNowhere,
        });
    }
}

const simple = results.filter(r => !r.facade);
const facades = results.filter(r => r.facade);
const totalUndeclared = simple.reduce((a, r) => a + r.usedButUndeclared.length, 0);
const totalFacadeUndeclared = facades.reduce((a, r) => a + r.usedButUndeclared.length, 0);
const totalUnused = results.reduce((a, r) => a + r.declaredButUnused.length, 0);
const totalNowhere = results.reduce((a, r) => a + r.resolvableNowhere.length, 0);

// Gated metrics (exit 1):
//   🔴 totalUndeclared  — must be 0 (always the hard gate)
//   ⚪ totalNowhere     — must be 0 (gated since drift-review C-23; the 5
//                         standing items were cleared, so any new one is a
//                         freshly-introduced dead dep — fix it or, if genuinely
//                         runtime-wired, add it to RUNTIME_WIRED with its call site)
//   🟡 totalUnused      — ratchet: must not exceed UNUSED_BASELINE
const unusedRegression = totalUnused > UNUSED_BASELINE;
const failed = totalUndeclared > 0 || totalNowhere > 0 || unusedRegression;

if (JSON_OUT) {
    console.log(JSON.stringify(
        { totalUndeclared, totalFacadeUndeclared, totalUnused, unusedBaseline: UNUSED_BASELINE, totalNowhere, results, scanFailures },
        null, 2));
    process.exit(failed ? 1 : 0);
}

const undeclared = simple.filter(r => r.usedButUndeclared.length);
console.log(`\n🔴 USED-BUT-UNDECLARED — high confidence (real dep, accessed, missing from manifest)`);
console.log(`   Silently no-ops today; no-ops or THROWS under ENFORCE_REQUIRES.`);
console.log(`   ${totalUndeclared} dep(s) across ${undeclared.length} module(s)\n`);
if (!undeclared.length) console.log('   (none)\n');
for (const r of undeclared) {
    console.log(`   ${r.name}  (${r.path})`);
    for (const d of r.usedButUndeclared) console.log(`      • ${d}`);
}

const facadeHits = facades.filter(r => r.usedButUndeclared.length);
if (facadeHits.length) {
    console.log(`\n🟠 FACADE FORWARD-THROUGH — ${totalFacadeUndeclared} dep(s) across ${facadeHits.length} facade(s)`);
    console.log(`   Forwarded to dynamically-imported sub-modules. Fine today; must be`);
    console.log(`   manifest-declared before ENFORCE_REQUIRES to keep forwarding.\n`);
    for (const r of facadeHits) console.log(`   ${r.name}: ${r.usedButUndeclared.join(', ')}`);
}

const unusedModules = results.filter(r => r.declaredButUnused.length);
console.log(`\n🟡 DECLARED-BUT-UNUSED — dead declarations (lower confidence; facades expected here)`);
console.log(`   ${totalUnused} declaration(s) across ${unusedModules.length} module(s)\n`);
for (const r of unusedModules) {
    console.log(`   ${r.name}${r.facade ? ' [facade]' : ''}  (${r.path})`);
    for (const d of r.declaredButUnused) console.log(`      • ${d}`);
}

const nowhereModules = results.filter(r => r.resolvableNowhere.length);
if (nowhereModules.length) {
    console.log(`\n⚪ ACCESSED-BUT-RESOLVABLE-NOWHERE — no manifest/depMappings/core source (${totalNowhere}) — GATED, must be 0`);
    console.log(`   A dead DI-contract dep (fallback always runs) or a local property.`);
    console.log(`   Fix the access, or if it's genuinely wired at runtime, add it to`);
    console.log(`   RUNTIME_WIRED in this script with its wiring call site.\n`);
    for (const r of nowhereModules) console.log(`   ${r.name}: ${r.resolvableNowhere.join(', ')}`);
}

if (unusedRegression) {
    console.log(`\n❌ UNUSED-DECLARATION RATCHET: ${totalUnused} > baseline ${UNUSED_BASELINE}.`);
    console.log(`   A new dead declaration was added. Remove it (or, after real cleanup,`);
    console.log(`   lower UNUSED_BASELINE — never raise it).`);
}

if (scanFailures.length) {
    console.log(`\n⚠️  Could not read ${scanFailures.length} manifest file(s):`);
    for (const f of scanFailures) console.log(`   ${f.name}: ${f.path} (${f.error})`);
}
console.log('');

process.exit(failed ? 1 : 0);
