#!/usr/bin/env node
/**
 * 🧪 Meta-tests — guards that keep the test suite honest.
 *
 * These are STATIC checks over the web/tests *.tests.js files (no browser needed). They
 * exist because the v2.336–2.339 audits found three recurring defect shapes that a
 * passing suite happily hid:
 *   1. tests that assert nothing (a name that claims behavior, a body that checks none)
 *   2. hand-rolled test() harnesses that call testFn() without awaiting it, so async
 *      test bodies report ✅ before running and their throws never fail the suite.
 *
 * CHECK 1 — harness conformance: any file that defines its own local test() harness
 *   must await async bodies (an `instanceof Promise` guard) or use the shared
 *   createProtectedTest/createTest helpers, which already do.
 *
 * CHECK 2 — no vacuous tests: every test('name', fn) block must contain a real
 *   assertion (a throw / assert / known throwing helper). Legitimate no-throw and
 *   no-op smoke tests — whose implicit assertion is "does not throw" and whose NAME
 *   says so — are explicitly allowlisted below. Adding a NEW assertion-free test that
 *   is not on the allowlist fails this check.
 *
 * Run: `npm run test:meta` (also wired into CI alongside test:sw).
 *
 * @module tests/automated/run-meta-tests
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..');
const c = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', blue: '\x1b[34m', gray: '\x1b[90m', cyan: '\x1b[36m'
};

// ---------------------------------------------------------------------------
// Allowlist for CHECK 2 (no-vacuous). Keyed by "<file basename>::<test name>".
// Every entry is a deliberate no-throw / no-op / smoke test whose NAME states that
// contract and whose body invokes the function under test — the harness fails on an
// uncaught throw, so "does not throw" is a real (implicit) assertion. Two groups:
//   • crash/no-op behavior tests (name says "does not throw" / "no-op" / "handles …")
//   • DI smoke tests ("set*Dependencies accepts …", "accepts mock dependencies")
// Keep this list tight: only add a test here if its no-throw run genuinely matches
// its name. A test that CLAIMS a specific behavior must assert it, not be allowlisted.
// ---------------------------------------------------------------------------
const VACUOUS_ALLOWLIST = new Set([
    // Empty. The initial 14-entry grandfathered baseline was driven to zero — every
    // pre-existing assertion-free test now asserts (or was removed as mis-premised).
    // Keep this empty: if a NEW test trips CHECK 2, add a real assertion — do NOT
    // allowlist it. This set exists only as a deliberate, reviewed escape hatch for a
    // genuine no-throw/no-op smoke test whose NAME cannot express that contract.
]);

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'automated' || entry.name === 'node_modules' || entry.name.includes('archive')) continue;
            walk(full, out);
        } else if (entry.name.endsWith('.tests.js')) {
            out.push(full);
        }
    }
    return out;
}

// Find the matching close paren/brace for a call/block starting at `openIdx` (the
// index of the opening char). Returns index of the matching close char, or -1.
function matchDelimiter(src, openIdx, openCh, closeCh) {
    let depth = 0;
    let inStr = null;      // ' " ` or null
    let inLineComment = false;
    let inBlockComment = false;
    let inTemplateExpr = 0; // ${ } nesting inside template strings
    for (let i = openIdx; i < src.length; i++) {
        const ch = src[i];
        const prev = src[i - 1];
        if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (ch === '*' && src[i + 1] === '/') { inBlockComment = false; i++; } continue; }
        if (inStr) {
            if (ch === '\\') { i++; continue; }
            if (inStr === '`' && ch === '$' && src[i + 1] === '{') { inTemplateExpr++; i++; continue; }
            if (inStr === '`' && ch === '}' && inTemplateExpr > 0) { inTemplateExpr--; continue; }
            if (ch === inStr && inTemplateExpr === 0) inStr = null;
            continue;
        }
        if (ch === '/' && src[i + 1] === '/') { inLineComment = true; i++; continue; }
        if (ch === '/' && src[i + 1] === '*') { inBlockComment = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
        if (ch === openCh) depth++;
        else if (ch === closeCh) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

// Strip line/block comments and string contents from a code fragment so assertion
// detection can't be fooled by the word "throw" inside a comment or string.
function stripCommentsAndStrings(src) {
    let out = '';
    let inStr = null, inLine = false, inBlock = false, tmplExpr = 0;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inLine) { if (ch === '\n') { inLine = false; out += ch; } continue; }
        if (inBlock) { if (ch === '*' && src[i + 1] === '/') { inBlock = false; i++; } continue; }
        if (inStr) {
            if (ch === '\\') { i++; continue; }
            if (inStr === '`' && ch === '$' && src[i + 1] === '{') { tmplExpr++; out += ' '; i++; continue; }
            if (inStr === '`' && ch === '}' && tmplExpr > 0) { tmplExpr--; continue; }
            if (ch === inStr && tmplExpr === 0) inStr = null;
            continue;
        }
        if (ch === '/' && src[i + 1] === '/') { inLine = true; i++; continue; }
        if (ch === '/' && src[i + 1] === '*') { inBlock = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; out += ' '; continue; }
        out += ch;
    }
    return out;
}

// A test legitimately needs NO explicit assertion when its NAME declares a no-throw /
// no-op / graceful-degradation / smoke contract: the harness fails on any uncaught
// throw, so "does not throw" IS the (implicit) assertion and the name says so. This is
// the audit's own distinction — a name that claims a SPECIFIC positive behavior
// ("calculates the move-up index") does NOT match here and must assert; a name that
// says "handles null gracefully" / "no-op when …" / "set*Dependencies accepts …" does.
const NO_THROW_NAME_PATTERNS = [
    /\b(does\s*not|doesn'?t|no|not|without|won'?t)\b[^.]{0,24}\bthrow/i,
    /\bno-?throw\b/i,
    /\bno-?ops?\b/i,
    /\bdoes\s+nothing\b/i,
    // "handles X" is only a no-throw idiom when X is a DEGENERATE input
    // ("handles missing task element", "handles corrupted localStorage") — a
    // bare "handles very large data export" is a behavioral claim and must
    // assert. Require a degenerate-input qualifier within reach of the verb.
    // NOTE: corrupt\w*/uninit\w* (not \bcorrupt\b) so "corrupted"/"uninitialized" match.
    /\bhandles?\b[^.]{0,40}\b(gracefully|missing|null|undefined|empty|absent|without|invalid|corrupt\w*|uninit\w*|malformed|nonexistent|non-existent|unavailable)\b/i,
    /\bvalidates?\b/i,                     // "validates array input" — validation smoke
    /\bsets?\s+dependenc/i,                // "sets dependencies correctly" — DI smoke
    /\btolerat/i,
    /\bignores?\b/i,
    /\bdefers?\b/i,
    /\bwithout\s+(crash|throw|error)/i,
    /\baccepts?\b/i,                       // "accepts …" — param/DI smoke test
    /set\w*Dependencies\b/i,
    /\bis\s+(defined|exported|a\s+function|available)\b/i,
    /\bclass\s+is\b/i,
    /\bis\s+exported\s+from\b/i,
    /\brequires?\b/i,                      // "requires AppState/taskList/draggedTask" — graceful guard
    /\bhandles?\s+[A-Za-z]+\s+not\s+ready\b/i,
    /\bfallback\b/i,                       // fallback-path smoke ("uses fallback …", "fallbackNotification …")
    /\bidempotent\b/i,
    /\bsafe\s+to\s+call\b/i,
    /\bcorrupt/i,                          // "handles corrupted localStorage …"
    /\blogs?\s+to\s+console\b/i,
    /\b(informational)\b/i,
];
function nameSignalsNoThrow(name) {
    return NO_THROW_NAME_PATTERNS.some(re => re.test(name));
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Collect the names of assertion helpers DEFINED in this file — any local function or
// block-body arrow whose body contains a `throw`. Many suites assert via tiny local
// helpers (`const eq = (a,b,label) => { if (a!==b) throw … }`, `includes(…)`), so the
// throw lives in the helper, not the test body. A call to one of these IS an assertion.
function findAssertionHelpers(src) {
    const code = stripCommentsAndStrings(src);
    const names = new Set();
    const consider = (name, braceIdx) => {
        if (braceIdx === -1) return;
        const end = matchDelimiter(code, braceIdx, '{', '}');
        if (end === -1) return;
        if (/\bthrow\b/.test(code.slice(braceIdx + 1, end))) names.add(name);
    };
    const patterns = [
        /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,                                   // function NAME(...) {
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,     // const NAME = (...) => {
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\*?\s*\([^)]*\)\s*\{/g, // const NAME = function(...) {
    ];
    for (const re of patterns) {
        let m;
        while ((m = re.exec(code)) !== null) {
            consider(m[1], code.indexOf('{', m.index + m[0].length - 1));
        }
    }
    return names;
}

// A body "asserts" if (ignoring comments/strings) it throws, calls a built-in assertion
// helper (assert/expect/should/fail), or calls one of the file's local throwing helpers.
function bodyHasAssertion(body, helperRe) {
    const code = stripCommentsAndStrings(body);
    if (/\bthrow\b/.test(code)
        || /\bassert\w*\s*\(/.test(code)
        || /\bexpect\s*\(/.test(code)
        || /\.should\b/.test(code)
        || /\bfail\s*\(/.test(code)) return true;
    return helperRe ? helperRe.test(code) : false;
}

// Extract every test('name', fn) / await test("name", fn) block from a source file.
function extractTestBlocks(src) {
    const blocks = [];
    // Match an optional `await`, then `test(` then a quoted name.
    const re = /(?:await\s+)?\btest\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const name = m[2];
        // Find the opening paren of this test(...) call.
        const callParenIdx = src.indexOf('(', m.index);
        if (callParenIdx === -1) continue;
        const callEnd = matchDelimiter(src, callParenIdx, '(', ')');
        if (callEnd === -1) continue;
        // The body is the arg-fn body: find the first { after the `,` inside the call.
        const bodyBraceIdx = src.indexOf('{', m.index + m[0].length - 1);
        if (bodyBraceIdx === -1 || bodyBraceIdx > callEnd) { blocks.push({ name, body: '' }); continue; }
        const bodyEnd = matchDelimiter(src, bodyBraceIdx, '{', '}');
        if (bodyEnd === -1) continue;
        blocks.push({ name, body: src.slice(bodyBraceIdx + 1, bodyEnd) });
        re.lastIndex = bodyEnd;
    }
    return blocks;
}

// Does the file define its own local test() harness (vs. only using the shared
// createProtectedTest/createTest helpers)?
function localHarnessInfo(src) {
    const code = stripCommentsAndStrings(src);
    const usesShared = /=\s*createProtectedTest\s*\(/.test(code) || /=\s*createTest\s*\(/.test(code);
    const definesLocal = /\bfunction\s+test\s*\(/.test(code) || /\bconst\s+test\s*=\s*(?:async\s*)?function\b/.test(code);
    // Await-safe if the harness awaits promises returned by testFn().
    const awaitsAsync = /instanceof\s+Promise/.test(code) || /await\s+testFn\s*\(/.test(code) || /await\s+Promise\.(race|all)\s*\(/.test(code);
    return { usesShared, definesLocal, awaitsAsync };
}

function main() {
    const files = walk(TESTS_DIR, []).sort();
    let harnessViolations = [];
    let vacuousViolations = [];
    let allowlistHits = 0;
    let noThrowSkips = 0;
    let totalTests = 0;

    for (const file of files) {
        const base = path.basename(file).replace(/\.tests\.js$/, '');
        if (base === 'MODULE_TEMPLATE') continue;
        const src = fs.readFileSync(file, 'utf8');

        // CHECK 1 — harness conformance
        const h = localHarnessInfo(src);
        if (h.definesLocal && !h.awaitsAsync) {
            harnessViolations.push(base);
        }

        // CHECK 2 — no vacuous tests. Build this file's local-assertion-helper matcher once.
        const helpers = findAssertionHelpers(src);
        const helperRe = helpers.size
            ? new RegExp('\\b(' + [...helpers].map(escapeRegex).join('|') + ')\\s*\\(')
            : null;
        for (const { name, body } of extractTestBlocks(src)) {
            totalTests++;
            if (bodyHasAssertion(body, helperRe)) continue;
            if (nameSignalsNoThrow(name)) { noThrowSkips++; continue; }
            const key = `${base}::${name}`;
            if (VACUOUS_ALLOWLIST.has(key)) { allowlistHits++; continue; }
            vacuousViolations.push(key);
        }
    }

    console.log(`${c.blue}================================================================${c.reset}`);
    console.log(`${c.blue}🧪 miniCycle Test-Suite Meta Guards${c.reset}`);
    console.log(`${c.blue}================================================================${c.reset}\n`);
    console.log(`${c.gray}   scanned ${files.length} test file(s), ${totalTests} test block(s)${c.reset}\n`);

    console.log(`${c.cyan}▸ CHECK 1 — harness conformance (async bodies must be awaited)${c.reset}`);
    if (harnessViolations.length === 0) {
        console.log(`   ${c.green}✅${c.reset} every local test() harness awaits async bodies\n`);
    } else {
        console.log(`   ${c.red}❌ ${harnessViolations.length} file(s) define a local test() harness that does not await testFn():${c.reset}`);
        harnessViolations.forEach(f => console.log(`      ${c.red}• ${f}.tests.js${c.reset}`));
        console.log(`   ${c.yellow}→ use createProtectedTest, or add: const result = testFn(); if (result instanceof Promise) await result;${c.reset}\n`);
    }

    console.log(`${c.cyan}▸ CHECK 2 — no vacuous tests (every test must assert or declare no-throw in its name)${c.reset}`);
    console.log(`${c.gray}   ${noThrowSkips} no-throw/no-op/smoke test(s) accepted by name, ${allowlistHits} explicitly allowlisted${c.reset}`);
    if (vacuousViolations.length === 0) {
        console.log(`   ${c.green}✅${c.reset} every non-allowlisted test contains a real assertion\n`);
    } else {
        console.log(`   ${c.red}❌ ${vacuousViolations.length} test(s) assert nothing and are not allowlisted:${c.reset}`);
        vacuousViolations.forEach(k => console.log(`      ${c.red}• ${k}${c.reset}`));
        console.log(`   ${c.yellow}→ add a real assertion, or (only if it is a genuine no-throw/no-op smoke test whose${c.reset}`);
        console.log(`   ${c.yellow}  NAME says so) add its "file::name" key to VACUOUS_ALLOWLIST in this script.${c.reset}\n`);
    }

    const failed = harnessViolations.length > 0 || vacuousViolations.length > 0;
    console.log(`${c.blue}================================================================${c.reset}`);
    if (failed) {
        console.log(`${c.red}❌ Meta guards failed.${c.reset}`);
        console.log(`${c.blue}================================================================${c.reset}`);
        process.exit(1);
    }
    console.log(`${c.green}🎉 Test-suite meta guards passed.${c.reset}`);
    console.log(`${c.blue}================================================================${c.reset}`);
}

main();
