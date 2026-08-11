#!/usr/bin/env node
/**
 * ES Built-in Floor Validator
 *
 * Catches the one class of browser-compat regression that no other gate can see:
 * a **post-es2020 built-in method** in shipped module code.
 *
 * Why this gate exists — the build target is es2020 (`scripts/build-web.cjs`,
 * `target: ['es2020']`) and the feature gate in miniCycle.html admits any browser
 * with `globalThis` (Chrome 71 / Safari 12.1 / Firefox 65). esbuild transpiles
 * SYNTAX down to the target, but it does NOT polyfill BUILT-INS: `Object.hasOwn`,
 * `String.prototype.replaceAll`, `Array.prototype.at` ship verbatim and throw
 * `TypeError: ... is not a function` at runtime on browsers the gate deliberately
 * lets in. Nothing else catches this:
 *   • lint has no target awareness;
 *   • Playwright runs modern Chromium, so every test passes;
 *   • the CSP/DI/comment gates look at different things entirely.
 * `Object.hasOwn` (es2022 — Chrome 93 / Safari 15.4) nearly shipped in v2.408
 * inside `getUniqueCycleName`, which would have thrown through the whole
 * routine-creation path on iOS 15.3 and earlier, with 3134/3134 tests green.
 *
 * WHAT IT CHECKS (three shapes, via the acorn AST — comments never match,
 * which matters because the fix for the v2.408 near-miss is a comment that
 * *names* `Object.hasOwn` as the thing NOT to use):
 *   1. Static calls:      Object.hasOwn, Promise.any, Promise.withResolvers,
 *                         Object.groupBy, Map.groupBy, Array.fromAsync
 *   2. Global references: WeakRef, FinalizationRegistry, AggregateError,
 *                         reportError, structuredClone*
 *   3. Prototype calls:   .replaceAll() .at() .findLast() .findLastIndex()
 *                         .toSorted() .toReversed() .toSpliced()
 *                         .isWellFormed() .toWellFormed()
 *      Receiver types are unknowable statically, so any call to these NAMES is
 *      flagged; a project method that happens to share a name gets an inline
 *      exemption (below). `.with()` is deliberately NOT in the list — the name
 *      is too generic (option builders, jQuery-ish chains) to flag.
 *
 * *structuredClone is a special case: coreBoot.js installs a polyfill in Phase 1
 * before any other module code runs, so uses are SAFE — but only while that
 * polyfill exists. This script VERIFIES the polyfill is still present in
 * coreBoot.js; delete it and every structuredClone call becomes a finding.
 *
 * KNOWN ACCEPTED STRAGGLER — Promise.allSettled (backupRestoreManager.js) IS
 * es2020, so it passes this gate by the stated contract, but it arrived slightly
 * later than globalThis in every engine (Chrome 76 vs 71, Safari 13 vs 12.1).
 * Browsers in that narrow 2019-era band pass the feature gate yet lack it. It is
 * not boot-critical (settings-reset flow only), so it is accepted, not flagged.
 *
 * Exemption: append `// es2020-ok: <reason>` on the flagged line (or the line
 * directly above) after VERIFYING the call is guarded (`typeof X === 'function'`)
 * or the receiver is a project object whose method merely shares the name.
 *
 * Usage: node scripts/validate-es-builtins.js [--json]
 * Exit 1 when any finding remains (gated at 0 from introduction).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Catalog — built-ins ABOVE the es2020 build target. First-support versions
// are noted so a future floor change can prune this list instead of guessing.
// ---------------------------------------------------------------------------

// Every catalog map is prototype-less (Object.create(null)): a plain literal
// inherits from Object.prototype, so `PROTO_METHODS['toString']` resolves the
// INHERITED native function (truthy) and flags every `.toString()` call in the
// codebase — 53 false positives on this script's very first run. The same
// own-property bug this gate's sibling fix closed in nameUtils.js (v2.408).
const bare = (obj) => Object.assign(Object.create(null), obj);

const STATIC_METHODS = bare({
    Object: bare({ hasOwn: 'es2022 (Chrome 93, Safari 15.4, FF 92)', groupBy: 'es2024 (Chrome 117, Safari 17.4)' }),
    Promise: bare({ any: 'es2021 (Chrome 85, Safari 14)', withResolvers: 'es2024 (Chrome 119, Safari 17.4)' }),
    Map: bare({ groupBy: 'es2024 (Chrome 117, Safari 17.4)' }),
    Array: bare({ fromAsync: 'es2024 (Chrome 121, Safari 16.4)' })
});

const GLOBALS = bare({
    WeakRef: 'es2021 (Chrome 84, Safari 14.1)',
    FinalizationRegistry: 'es2021 (Chrome 84, Safari 14.1)',
    AggregateError: 'es2021 (Chrome 85, Safari 14)',
    reportError: 'web api (Chrome 95, Safari 15.4)',
    structuredClone: 'web api (Chrome 98, Safari 15.4) — POLYFILLED in coreBoot.js'
});

const PROTO_METHODS = bare({
    replaceAll: 'es2021 (Chrome 85, Safari 13.1)',
    at: 'es2022 (Chrome 92, Safari 15.4)',
    findLast: 'es2023 (Chrome 97, Safari 15.4)',
    findLastIndex: 'es2023 (Chrome 97, Safari 15.4)',
    toSorted: 'es2023 (Chrome 110, Safari 16)',
    toReversed: 'es2023 (Chrome 110, Safari 16)',
    toSpliced: 'es2023 (Chrome 110, Safari 16)',
    isWellFormed: 'es2024 (Chrome 111, Safari 16.4)',
    toWellFormed: 'es2024 (Chrome 111, Safari 16.4)'
});

const EXEMPT_MARKER = 'es2020-ok:';

// ---------------------------------------------------------------------------
// File scope — mirrors the lint scope (shipped code only), plus version.js
// because it executes pre-gate on every browser. Excludes tests, the frozen
// lite/ fallback, and modules/testing/ (dev-only, behind the testing modal).
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
    for (const root of ['service-worker.js', 'miniCycle-main.js', 'boot-sw.js', 'version.js']) {
        const full = path.join(WEB_ROOT, root);
        if (fs.existsSync(full)) files.push(full);
    }
    return files;
}

// ---------------------------------------------------------------------------
// The structuredClone polyfill contract: exempt the global ONLY while the
// coreBoot polyfill actually exists.
// ---------------------------------------------------------------------------

const coreBootSrc = fs.readFileSync(path.join(WEB_ROOT, 'modules', 'boot', 'coreBoot.js'), 'utf8');
const structuredClonePolyfilled =
    coreBootSrc.includes("typeof structuredClone === 'undefined'") &&
    coreBootSrc.includes('globalThis.structuredClone');

// ---------------------------------------------------------------------------
// AST scan
// ---------------------------------------------------------------------------

function parse(src, file) {
    const opts = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
    try {
        return acorn.parse(src, { ...opts, sourceType: 'module' });
    } catch {
        // service-worker.js / boot-sw.js are classic scripts
        return acorn.parse(src, { ...opts, sourceType: 'script' });
    }
}

function walkAst(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const child = node[key];
        if (Array.isArray(child)) {
            for (const c of child) walkAst(c, visit);
        } else if (child && typeof child.type === 'string') {
            walkAst(child, visit);
        }
    }
}

function scanFile(file) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const rel = path.relative(WEB_ROOT, file);
    const findings = [];

    // Cheap pre-filter: skip the (majority of) files that mention none of the names
    const anyName = [
        ...Object.keys(GLOBALS),
        ...Object.keys(PROTO_METHODS),
        ...Object.values(STATIC_METHODS).flatMap((m) => Object.keys(m))
    ];
    if (!anyName.some((n) => src.includes(n))) return findings;

    let ast;
    try {
        ast = parse(src, file);
    } catch (e) {
        findings.push({ file: rel, line: e.loc?.line ?? 0, what: 'PARSE ERROR', why: e.message });
        return findings;
    }

    const exemptAt = (line) => {
        const here = lines[line - 1] ?? '';
        const above = lines[line - 2] ?? '';
        return here.includes(EXEMPT_MARKER) || above.trim().startsWith('//') && above.includes(EXEMPT_MARKER);
    };

    const add = (line, what, why) => {
        if (!exemptAt(line)) findings.push({ file: rel, line, what, why });
    };

    walkAst(ast, (node) => {
        // Shape 1: static methods — Object.hasOwn(...) etc.
        if (
            node.type === 'MemberExpression' && !node.computed &&
            node.object?.type === 'Identifier' && node.property?.type === 'Identifier'
        ) {
            const why = STATIC_METHODS[node.object.name]?.[node.property.name];
            if (why) add(node.loc.start.line, `${node.object.name}.${node.property.name}`, why);
        }

        // Shape 2: global references — bare identifiers, skipping the positions
        // where the name is a declaration or a property key, and skipping
        // `typeof X` guards (those are the SAFE way to use these globals).
        if (node.type === 'Identifier' && GLOBALS[node.name]) {
            // handled via parent context below — acorn has no parent links, so we
            // detect the unsafe shapes at their parent nodes instead:
            // CallExpression callee / NewExpression callee / plain argument use.
        }
        if (node.type === 'CallExpression' || node.type === 'NewExpression') {
            const callee = node.callee;
            if (callee?.type === 'Identifier' && GLOBALS[callee.name]) {
                if (callee.name === 'structuredClone' && structuredClonePolyfilled) return;
                add(node.loc.start.line, callee.name, GLOBALS[callee.name]);
            }
        }

        // Shape 3: prototype methods — any receiver, by name.
        if (node.type === 'CallExpression') {
            let callee = node.callee;
            if (callee?.type === 'ChainExpression') callee = callee.expression;
            if (
                callee?.type === 'MemberExpression' && !callee.computed &&
                callee.property?.type === 'Identifier' && PROTO_METHODS[callee.property.name]
            ) {
                add(node.loc.start.line, `.${callee.property.name}()`, PROTO_METHODS[callee.property.name]);
            }
        }
    });

    return findings;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const files = collectFiles();
const findings = files.flatMap(scanFile);
const jsonMode = process.argv.includes('--json');

if (jsonMode) {
    console.log(JSON.stringify({ total: findings.length, filesScanned: files.length, structuredClonePolyfilled, findings }, null, 2));
    process.exit(findings.length > 0 ? 1 : 0);
}

console.log(`\n🧯 ES BUILT-IN FLOOR CHECK — no post-es2020 built-ins in shipped code`);
console.log(`   scanned ${files.length} files | build target: es2020 | gate floor: globalThis (Chrome 71 / Safari 12.1)`);
console.log(`   structuredClone polyfill in coreBoot.js: ${structuredClonePolyfilled ? 'present ✓' : 'MISSING — uses now flagged'}\n`);

if (findings.length === 0) {
    console.log('✅ PASS — every built-in used is within the es2020 floor.\n');
    process.exit(0);
}

console.log(`❌ ${findings.length} post-es2020 built-in(s) — GATED, must be 0\n`);
for (const f of findings) {
    console.log(`   ${f.file}:${f.line}`);
    console.log(`      ${f.what}  —  ${f.why}`);
}
console.log(`
   esbuild's target:['es2020'] transpiles SYNTAX, not built-ins — these ship
   verbatim and throw TypeError on browsers the feature gate admits.
   Fix: use the es2020-or-older equivalent (e.g. Object.prototype.hasOwnProperty
   .call for Object.hasOwn, .indexOf/.slice for .at, split/join or a /g-regex
   .replace for .replaceAll) — or, if the call is genuinely guarded or the
   receiver is a project object sharing the name, append
   \`// ${EXEMPT_MARKER} <reason>\` to the line after verifying it.
`);
process.exit(1);
