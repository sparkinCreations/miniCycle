#!/usr/bin/env node
/**
 * build-web.cjs — release bundling for miniCycle (BUILD_PIPELINE_PLAN.md Phase 1)
 *
 * Produces web/dist/: a deployable copy where every runtime-imported module is a
 * minified esbuild ENTRY at its STABLE path (so the ~60 runtime-computed
 * `import(withV('…'))` specifiers keep resolving with zero runtime changes),
 * with shared code split into content-hashed chunks. Dev stays no-build.
 *
 *   DEV:   npm start          → python serves web/ (pristine source, ?v= as today)
 *   PROD:  node scripts/build-web.cjs → dist/ (bundled, minified, generated precache)
 *
 * Design invariants (do not break):
 *  - Entries keep stable paths; ONLY chunks get [hash] names. Full entry-hashing
 *    is a follow-up phase (needs a runtime module map — see plan doc).
 *  - `splitting: true` is MANDATORY: it guarantees a module referenced both
 *    statically (by another entry) and dynamically (as its own entry) lives in
 *    ONE shared chunk — module-level state stays single-instance even though
 *    `?v=` query strings give entries multiple URL cache keys.
 *  - `keepNames: true`: the DI layer string-matches export/class names.
 *  - HTML and its inline scripts are copied byte-identical → CSP hashes valid.
 *  - service-worker.js gets its BOOT_CRITICAL list regenerated between the
 *    __BUILD_JS_PRECACHE_START/END__ markers from actual build output.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const WEB = path.resolve(__dirname, '..');
const DIST = path.join(WEB, 'dist');
const rel = (p) => path.relative(WEB, p).split(path.sep).join('/');

// ── helpers ─────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function stripComments(src) {
  // Good enough for specifier scanning (not a full parser): block + line comments.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function fail(msg) { console.error('❌ build-web: ' + msg); process.exit(1); }

// ── 1. entry list ───────────────────────────────────────────────────────────
function collectEntries() {
  const entries = new Set();
  const misses = [];
  const addResolved = (specifier, fromDir, source) => {
    const clean = specifier.split('?')[0].split('${')[0];
    if (!clean.endsWith('.js')) return;
    const abs = path.resolve(fromDir, clean);
    if (!abs.startsWith(WEB)) return;
    if (!fs.existsSync(abs)) { misses.push(`${clean}  (from ${source})`); return; }
    entries.add(abs);
  };

  // (a) every manifest module path (loaded via import(withV(manifest.path)))
  const manifestSrc = fs.readFileSync(path.join(WEB, 'modules/boot/moduleManifests.js'), 'utf8');
  for (const m of manifestSrc.matchAll(/path:\s*'([^']+)'/g)) {
    addResolved(m[1], path.join(WEB, 'modules/boot'), 'moduleManifests.js');
  }

  // (b) every dynamic import specifier in modules/ + miniCycle-main.js
  const scanFiles = walk(path.join(WEB, 'modules')).filter(f => f.endsWith('.js'));
  scanFiles.push(path.join(WEB, 'miniCycle-main.js'));
  const dynRe = /import\(\s*(?:withV\(\s*)?[`'"]([^`'"]+?)[`'"]/g;
  const concatRe = /import\(\s*'([^']+)'\s*\+/g;
  for (const f of scanFiles) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(dynRe)) addResolved(m[1], path.dirname(f), rel(f));
    for (const m of src.matchAll(concatRe)) addResolved(m[1], path.dirname(f), rel(f));
  }

  // (c) the HTML entrypoint
  entries.add(path.join(WEB, 'miniCycle-main.js'));

  if (misses.length) fail('unresolvable dynamic import specifiers:\n  ' + misses.join('\n  '));
  return [...entries].sort();
}

// ── 2. copy pass ────────────────────────────────────────────────────────────
const COPY_EXCLUDE = new Set([
  'dist', 'node_modules', 'modules', 'scripts', 'docs', 'backup',
  'package.json', 'package-lock.json', '.eslintrc.json', '.DS_Store',
]);
function copyStatic() {
  for (const name of fs.readdirSync(WEB)) {
    if (COPY_EXCLUDE.has(name)) continue;
    fs.cpSync(path.join(WEB, name), path.join(DIST, name), { recursive: true });
  }
  // modules/ non-JS assets fetched at runtime (e.g. labels/loading-tips.json)
  for (const f of walk(path.join(WEB, 'modules'))) {
    if (f.endsWith('.js')) continue;
    const dest = path.join(DIST, rel(f));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
}

// ── 3. service-worker precache injection ────────────────────────────────────
function injectPrecache(builtJs) {
  const swPath = path.join(DIST, 'service-worker.js');
  const sw = fs.readFileSync(swPath, 'utf8');
  const START = '// __BUILD_JS_PRECACHE_START__';
  const END = '// __BUILD_JS_PRECACHE_END__';
  const s = sw.indexOf(START), e = sw.indexOf(END);
  if (s === -1 || e === -1) fail('precache markers missing from service-worker.js');
  const shell = [
    './miniCycle.html', './version.js', './styles/main.css',
  ];
  const list = shell.concat(builtJs.map(p => './' + p));
  const generated =
    START + '  (generated by scripts/build-web.cjs — bundled entries + chunks)\n' +
    'var BOOT_CRITICAL = [\n' +
    list.map(u => `  '${u}'`).join(',\n') +
    '\n];\n';
  fs.writeFileSync(swPath, sw.slice(0, s) + generated + sw.slice(e + END.length));
  return list.length;
}

// ── runtime-import rewriter plugin ──────────────────────────────────────────
// Two hazards make raw runtime imports unsafe in the bundle:
//  1. esbuild compiles template-literal dynamic imports (`./x.js?v=${V}`) into a
//     GLOB-MAP lookup; when the glob matched nothing at build time (query strings
//     never match files) it THROWS "Module not found in bundle" at runtime.
//  2. splitting can hoist importing code into modules/chunks/, breaking RELATIVE
//     runtime specifiers ('./coreBoot.js' from a chunk resolves to chunks/…).
// Fix both at once: rewrite every runtime-computed specifier to a ROOT-ABSOLUTE
// path and wrap in a sequence expression `(0, …)` so esbuild treats it as opaque
// runtime data. Source stays untouched — this happens only in the build.
// Constraint: assumes the app is served at the DOMAIN ROOT (true for Netlify,
// the Apache mirror, and dev servers).
function makeRewritePlugin() {
  const toAbs = (spec, dir) => '/' + rel(path.resolve(dir, spec));
  return {
    name: 'runtime-import-rewriter',
    setup(build) {
      build.onLoad({ filter: /\.js$/ }, (args) => {
        if (!args.path.startsWith(WEB) || args.path.includes('node_modules')) return null;
        const dir = path.dirname(args.path);
        let src = fs.readFileSync(args.path, 'utf8');

        // moduleManifests.js: manifest.path values feed import(withV(path)) in a
        // possibly-relocated moduleLoader — make them root-absolute data.
        if (args.path.endsWith('modules/boot/moduleManifests.js')) {
          src = src.replace(/path:\s*'(\.\.?\/[^']+)'/g, (_, p) => `path: '${toAbs(p, dir)}'`);
        }

        // import(withV('REL')) → import(withV('/ABS'))  (withV just appends ?v=)
        src = src.replace(/withV\(\s*(['"`])(\.\.?\/[^'"`]+?)\1\s*\)/g,
          (_, q, p) => `withV(${q}${toAbs(p, dir)}${q})`);

        // NOTE on opacity: minify folds `(0,'x')` and `String('x')` back into
        // literals (verified empirically) — esbuild then tries to bundle-resolve
        // them and errors. Two forms survive minified: templates containing a
        // real ${expr}, and ['x'].join('').

        // import(`REL?v=${V}`) → import(`/ABS?v=${V}`)  (the ${} keeps it runtime);
        // a template with NO expression needs the join('') form instead.
        src = src.replace(/import\(\s*`(\.\.?\/[^`?$]+?)((?:\?|\$)[^`]*)?`\s*\)/g,
          (_, p, tail) => tail
            ? `import(\`${toAbs(p, dir)}${tail}\`)`
            : `import(['${toAbs(p, dir)}'].join(''))`);

        // import('REL' + expr) → import('/ABS' + expr)  (unknown expr = unfoldable)
        src = src.replace(/import\(\s*'(\.\.?\/[^']+?)'\s*\+\s*([^)]+?)\)/g,
          (_, p, expr) => `import('${toAbs(p, dir)}' + ${expr})`);

        // bare import('./REL.js') → import(['/ABS.js'].join(''))
        src = src.replace(/import\(\s*(['"])(\.\.?\/[^'"]+?\.js)\1\s*\)/g,
          (_, q, p) => `import(['${toAbs(p, dir)}'].join(''))`);

        return { contents: src, loader: 'js' };
      });
    },
  };
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const entryPoints = collectEntries();
  console.log(`🧩 entries: ${entryPoints.length} (manifest modules + facade sub-modules + boot chain + main)`);

  const result = await esbuild.build({
    entryPoints,
    outdir: DIST,
    outbase: WEB,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    keepNames: true,
    sourcemap: true,
    target: ['es2020'],
    entryNames: '[dir]/[name]',              // STABLE paths — runtime specifiers keep working
    chunkNames: 'modules/chunks/chunk-[hash]', // shared code — immutable, hashed
    metafile: true,
    logLevel: 'warning',
    plugins: [makeRewritePlugin()],
  });

  copyStatic();

  const outputs = Object.keys(result.metafile.outputs)
    .filter(p => p.endsWith('.js'))
    .map(p => rel(path.resolve(p)));
  const chunkCount = outputs.filter(p => p.includes('modules/chunks/')).length;
  const precacheCount = injectPrecache(outputs);

  const totalBytes = Object.entries(result.metafile.outputs)
    .filter(([p]) => p.endsWith('.js'))
    .reduce((s, [, o]) => s + o.bytes, 0);
  console.log(`📦 built ${outputs.length} JS files (${outputs.length - chunkCount} entries + ${chunkCount} chunks), ${(totalBytes / 1024 / 1024).toFixed(2)}MB minified`);
  console.log(`🛰  SW precache regenerated: ${precacheCount} URLs`);
  console.log(`✅ dist/ ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => fail(e.message));
