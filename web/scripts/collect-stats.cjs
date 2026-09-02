#!/usr/bin/env node
/**
 * collect-stats.cjs — ONE implementation of every volatile project metric.
 *
 * Three consumers used to count independently: update-version.sh Stage 5B
 * (docs/PROJECT_STATS.md), Stage 5C (the SparkinCreations mirror), and — once
 * dist/stats.json existed — the build. Three copies of "how many tests are
 * there" is three chances for two public surfaces to disagree, so they all
 * call this instead.
 *
 * Usage:
 *   node scripts/collect-stats.cjs               → JSON to stdout
 *   node scripts/collect-stats.cjs --out FILE    → write JSON to FILE
 *   node scripts/collect-stats.cjs --shell       → STATS_*=value lines for eval
 *
 * Counting semantics are deliberately IDENTICAL to the shell one-liners they
 * replaced, so published numbers don't jump — with one intentional exception,
 * docFiles (see below).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { testTreeFingerprint } = require('./test-tree-fingerprint.cjs');

const WEB = path.resolve(__dirname, '..');
const p = (...parts) => path.join(WEB, ...parts);

/** Recursively list files under dir, skipping nothing (callers filter). */
function walk(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) out.push(...walk(abs));
        else out.push(abs);
    }
    return out;
}

const countFiles = (dir, ext) => walk(p(dir)).filter((f) => f.endsWith(ext)).length;

/** Lines matching `re` across every `ext` file under `dir` — mirrors `grep -r | wc -l`. */
function countMatchingLines(dir, ext, re) {
    let n = 0;
    for (const f of walk(p(dir))) {
        if (!f.endsWith(ext)) continue;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (re.test(line)) n++;
    }
    return n;
}

/**
 * "Total Tests" — the number the module runner actually counted.
 *
 * This used to be `countMatchingLines('tests', '.js', /test\(/)`, which
 * reported 3756 against a runner total of 3567. The 189 extra were regex calls
 * (`re.test(...)`), files the runner never loads, and helper matches. A static
 * grep cannot be authoritative here: only the runner knows which suites
 * registered, so only the runner can count them.
 *
 * run-browser-tests.cjs writes tests/.test-count.json on every run. We use it
 * when its fingerprint still matches the test tree on disk; otherwise the
 * manifest predates the current suites and we fall back to the old grep with a
 * warning — a number that is visibly approximate beats a stale one that looks
 * exact.
 */
function readTestCount() {
    const grepCount = () => countMatchingLines('tests', '.js', /test\(/);
    const manifestPath = p('tests/.test-count.json');
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
        console.warn('⚠️  tests/.test-count.json missing — falling back to the static grep.');
        console.warn('   Run `npm test` to refresh it so PROJECT_STATS reports the real total.');
        return grepCount();
    }
    if (manifest.fingerprint !== testTreeFingerprint()) {
        console.warn('⚠️  tests/.test-count.json is stale (test files changed since it was written).');
        console.warn('   Falling back to the static grep; run `npm test` to refresh it.');
        return grepCount();
    }
    if (!Number.isInteger(manifest.totalTests) || manifest.totalTests <= 0) {
        console.warn('⚠️  tests/.test-count.json has no usable total — falling back to the static grep.');
        return grepCount();
    }
    return manifest.totalTests;
}

const lineCount = (file) => {
    const abs = p(file);
    if (!fs.existsSync(abs)) return 0;
    // `wc -l` counts newlines; match it so boot-file numbers stay comparable.
    return (fs.readFileSync(abs, 'utf8').match(/\n/g) || []).length;
};

/**
 * Markdown files under docs/.
 *
 * INTENTIONAL DIVERGENCE from the old `find docs -name "*.md"`: that ignores
 * .gitignore, so a local release counted personal/untracked files (DEVELOPER_
 * PROFILE.md, stray iCloud "<name> 2.md" duplicates) while a cloud release from
 * a clean clone did not — the same commit published a different number
 * depending on which machine cut the release. This number is public on
 * docs.minicycle.app, so it must not depend on the operator's working tree.
 * Falls back to the filesystem only if git is unavailable.
 */
function countDocFiles() {
    try {
        const out = execFileSync('git', ['ls-files', 'docs'], { cwd: WEB, encoding: 'utf8' });
        return out.split('\n').filter((f) => f.endsWith('.md')).length;
    } catch {
        return countFiles('docs', '.md');
    }
}

function readVersion() {
    const m = fs.readFileSync(p('version.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']*)'/);
    return m ? m[1] : 'unknown';
}

function readLiteVersion() {
    const abs = p('lite', 'miniCycle-lite-scripts.js');
    if (!fs.existsSync(abs)) return 'unknown';
    const m = fs.readFileSync(abs, 'utf8').match(/var currentVersion = '([^']*)'/);
    return m ? m[1] : 'unknown';
}

function readSchemaVersion() {
    const abs = p('modules', 'core', 'appState.js');
    if (!fs.existsSync(abs)) return 'unknown';
    const m = fs.readFileSync(abs, 'utf8').match(/schemaVersion:\s*["']([\d.]+)["']/);
    return m ? m[1] : 'unknown';
}

/** Per-directory module counts, derived from modules/*&#47; — never a hardcoded list. */
function moduleBreakdown() {
    const root = p('modules');
    const out = {};
    if (!fs.existsSync(root)) return out;
    for (const name of fs.readdirSync(root)) {
        const abs = path.join(root, name);
        if (!fs.statSync(abs).isDirectory()) continue;
        out[name] = walk(abs).filter((f) => f.endsWith('.js')).length;
    }
    return out;
}

const BOOT_FILES = [
    'miniCycle-main.js',
    'modules/boot/orchestrator.js',
    'modules/boot/coreBoot.js',
    'modules/boot/featureBoot.js',
    'modules/boot/uiBoot.js',
];

function collect() {
    const bootFiles = {};
    for (const f of BOOT_FILES) bootFiles[f] = lineCount(f);

    const moduleFiles = walk(p('modules')).filter((f) => f.endsWith('.js'));
    const moduleLines = moduleFiles.reduce(
        (sum, f) => sum + (fs.readFileSync(f, 'utf8').match(/\n/g) || []).length, 0);

    return {
        // Keys consumed by the SparkinCreations homepage — do not rename.
        version: readVersion(),
        modules: moduleFiles.length,
        tests: readTestCount(),
        testFiles: countFiles('tests', '.tests.js'),
        lines: moduleLines,
        generated: new Date().toISOString().slice(0, 10),
        // Additions.
        liteVersion: readLiteVersion(),
        schemaVersion: readSchemaVersion(),
        cssFiles: countFiles('styles', '.css'),
        jsdocBlocks: countMatchingLines('modules', '.js', /^\/\*\*/),
        docFiles: countDocFiles(),
        bootFiles,
        bootTotal: Object.values(bootFiles).reduce((a, b) => a + b, 0),
        moduleBreakdown: moduleBreakdown(),
    };
}

module.exports = { collect };

if (require.main === module) {
    const args = process.argv.slice(2);
    const stats = collect();

    if (args.includes('--shell')) {
        // Flat scalars only — nested objects are handled by the JS consumers.
        const emit = (k, v) => console.log(`STATS_${k.toUpperCase()}='${String(v).replace(/'/g, "")}'`);
        for (const [k, v] of Object.entries(stats)) {
            if (v !== null && typeof v === 'object') continue;
            emit(k, v);
        }
        for (const [dir, n] of Object.entries(stats.moduleBreakdown)) {
            emit(`DIR_${dir.replace(/[^A-Za-z0-9]/g, '_')}`, n);
        }
        for (const [file, n] of Object.entries(stats.bootFiles)) {
            emit(`BOOT_${path.basename(file, '.js').replace(/[^A-Za-z0-9]/g, '_')}`, n);
        }
        process.exit(0);
    }

    const json = JSON.stringify(stats, null, 2) + '\n';
    const outIdx = args.indexOf('--out');
    if (outIdx !== -1 && args[outIdx + 1]) {
        const dest = path.resolve(WEB, args[outIdx + 1]);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, json);
        console.log(`✅ wrote ${path.relative(WEB, dest)}`);
    } else {
        process.stdout.write(json);
    }
}
