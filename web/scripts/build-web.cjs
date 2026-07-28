#!/usr/bin/env node
/**
 * build-web.cjs — release bundling for miniCycle (BUILD_PIPELINE_PLAN.md)
 *
 * Phase 1 (Jul 13 2026) bundled with STABLE entry paths. This version completes
 * the plan: FULL ENTRY HASHING + runtime module map + CSS bundling.
 *
 *   DEV:   npm start          → python serves web/ (pristine source, ?v= as today)
 *   PROD:  node scripts/build-web.cjs → dist/ (bundled, hashed, generated precache)
 *
 * Output layout:
 *   dist/build/**            — ALL hashed output (JS entries, chunks, CSS bundle).
 *                              Immutable by name → netlify serves it with
 *                              Cache-Control: immutable; SW serves it cache-first.
 *   dist/version.js          — source copy + appended __MC_MODULE_MAP
 *                              (source path → hashed URL). The ONLY indirection:
 *                              importers reference source paths, only the map
 *                              knows hashes, so there is no hash cascade.
 *   dist/modules/**.js       — tiny stable-path SHIMS (`export * from <hashed>`)
 *                              so the in-browser testing modal's direct source-
 *                              path imports keep working on production.
 *   dist/service-worker.js   — precache lists + MODULE_MAP injected between
 *                              marker comments.
 *   dist/miniCycle.html      — byte-identical EXCEPT attribute rewrites (main.js
 *                              script src + main.css hrefs → hashed URLs).
 *                              Inline script CONTENT untouched → CSP hashes valid.
 *
 * Design invariants (do not break):
 *  - Content identity: every runtime-imported JS/CSS byte lives under /build/
 *    with a content hash in its name. A mixed old/new module graph is
 *    unrepresentable — old HTML can only name old hashes.
 *  - Runtime imports resolve through __MC_MODULE_MAP. Mapped URLs are used BARE
 *    (matches the SW precache key → kills the ?v= double-fetch). The ?v= form
 *    survives only as the dev fallback and the boot-retry freshness suffix.
 *  - orchestrator.js keeps its `${vParam}` tail ON TOP of the mapped URL — the
 *    boot-retry teardown depends on distinct URLs yielding fresh instances.
 *  - `splitting: true` is MANDATORY (single-instance shared state).
 *  - `keepNames: true`: the DI layer string-matches export/class names.
 *  - Minify folds `(0,'x')` and `String('x')` back into literals — the rewrite
 *    forms that survive are property-access expressions, templates containing a
 *    real ${expr}, and ['x'].join(''). Don't "simplify" them.
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
// EVERY module is an entry (not just dynamic-import targets): the stable-path
// shims must cover every module the in-browser testing modal imports directly,
// and statically-only modules (diBase, labelResolver, …) would otherwise have
// no standalone hashed file to shim to. `splitting` keeps shared code in
// single-instance chunks regardless of entry count. The specifier scan below
// is retained purely as VALIDATION (fails the build on unresolvable imports).
function collectEntries() {
  const entries = new Set();
  const misses = [];
  for (const f of walk(path.join(WEB, 'modules'))) {
    if (f.endsWith('.js')) entries.add(f);
  }
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

// ── 2b. docs site (curated) ─────────────────────────────────────────────────
// docs/ is excluded from the blanket copy above (COPY_EXCLUDE) and published
// here instead, minus the folders below.
//
// HISTORY: before July 19 2026 Netlify published the raw web/ tree, so
// /docs worked by accident — the same accident that served package.json and
// scripts/. Making the build authoritative ended that, and /docs 404'd until
// this pass was added.
//
// docsify is CLIENT-SIDE: index.html fetches _sidebar.md and every .md over
// HTTP at runtime. So a partial publish MUST also filter the sidebar, or the
// live site renders nav entries that 404. That is what filterSidebar does.
const DOCS_EXCLUDE_DIRS = new Set([
  'archive',      // historical snapshots — large, and deliberately stale
  'future-work',  // unshipped plans
  'incidents',    // internal postmortems
]);
const DOCS_EXCLUDE_FILES = new Set([
  'DEVELOPER_PROFILE.md',  // personal
  '.DS_Store',
]);

function filterSidebar(src) {
  // Drop link lines pointing into an excluded path, then drop section headers
  // left with no children. Two passes so an emptied section disappears cleanly.
  const excluded = (target) => {
    const clean = decodeURIComponent(target.split('#')[0]).replace(/^\.\//, '');
    const top = clean.split('/')[0];
    return DOCS_EXCLUDE_DIRS.has(top) || DOCS_EXCLUDE_FILES.has(clean);
  };
  const kept = src.split('\n').filter((line) => {
    const m = line.match(/\[[^\]]*\]\(([^)]+)\)/);
    if (!m) return true;
    if (/^https?:|^mailto:|^\/$/.test(m[1])) return true;
    return !excluded(m[1]);
  });

  const out = [];
  for (let i = 0; i < kept.length; i++) {
    const line = kept[i];
    const isHeader = /^\*\s+\*\*/.test(line);
    if (isHeader) {
      // keep only if a child link follows before the next header
      let hasChild = false;
      for (let j = i + 1; j < kept.length; j++) {
        if (/^\*\s+\*\*/.test(kept[j])) break;
        if (/\[[^\]]*\]\([^)]+\)/.test(kept[j])) { hasChild = true; break; }
      }
      if (!hasChild) { while (i + 1 < kept.length && !/^\*\s+\*\*/.test(kept[i + 1])) i++; continue; }
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function copyDocs() {
  const srcRoot = path.join(WEB, 'docs');
  if (!fs.existsSync(srcRoot)) { console.log('⏭  docs/ not found — skipping docs publish'); return 0; }
  const destRoot = path.join(DIST, 'docs');
  let copied = 0;

  const walkDocs = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const relative = path.relative(srcRoot, abs).split(path.sep).join('/');
      const top = relative.split('/')[0];
      if (fs.statSync(abs).isDirectory()) {
        if (DOCS_EXCLUDE_DIRS.has(top)) continue;
        walkDocs(abs);
      } else {
        if (DOCS_EXCLUDE_FILES.has(name) || DOCS_EXCLUDE_DIRS.has(top)) continue;
        const dest = path.join(destRoot, relative);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(abs, dest);
        copied++;
      }
    }
  };
  walkDocs(srcRoot);

  const sidebar = path.join(destRoot, '_sidebar.md');
  if (fs.existsSync(sidebar)) {
    fs.writeFileSync(sidebar, filterSidebar(fs.readFileSync(sidebar, 'utf8')));
  }

  // Body prose still links into withheld folders (and occasionally escapes docs/
  // entirely, e.g. ../../../LICENSE). Those would 404 on the published site.
  // The repo is public, so rewrite them — in the dist copy ONLY — to GitHub, and
  // the reader still reaches the real document instead of a dead end.
  const rewritten = rewriteEscapingLinks(srcRoot, destRoot);

  // Gate: a published link that 404s is worse than no docs site at all.
  const broken = [];
  for (const f of walk(destRoot)) {
    if (!f.endsWith('.md')) continue;
    const dir = path.dirname(f);
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const t = m[1];
      if (/^https?:|^mailto:|^\/$|^#/.test(t)) continue;
      const target = decodeURIComponent(t.split('#')[0]).trim();
      if (!target || NON_FILE_DOC_LINK.test(target)) continue;
      if (!fs.existsSync(path.resolve(dir, target))) {
        broken.push(path.relative(destRoot, f) + ' -> ' + target);
      }
    }
  }
  if (broken.length) {
    fail('published docs have ' + broken.length + ' dead link(s):\n  ' + broken.slice(0, 20).join('\n  '));
  }
  return { copied, rewritten };
}

// Link targets that are not files (source citations, placeholder text in prose).
const NON_FILE_DOC_LINK = /(:\d+$)|(^[a-z]+$)/;
const GITHUB_BLOB = 'https://github.com/sparkinCreations/miniCycle/blob/main/';

function rewriteEscapingLinks(srcRoot, destRoot) {
  const REPO = path.dirname(WEB);
  let count = 0;
  for (const f of walk(destRoot)) {
    if (!f.endsWith('.md')) continue;
    const relDir = path.dirname(path.relative(destRoot, f));
    const srcDir = path.join(srcRoot, relDir);   // where this file lives in source
    const destDir = path.dirname(f);
    const text = fs.readFileSync(f, 'utf8');
    const out = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (whole, label, link) => {
      if (/^https?:|^mailto:|^\/$|^#/.test(link)) return whole;
      const [base, frag] = link.split('#');
      const target = decodeURIComponent(base).trim();
      if (!target || NON_FILE_DOC_LINK.test(target)) return whole;
      if (fs.existsSync(path.resolve(destDir, target))) return whole;   // fine as-is
      const inSource = path.resolve(srcDir, target);                    // same link, source tree
      if (!fs.existsSync(inSource)) return whole;                       // genuinely dangling — let the gate report it
      count++;
      return `[${label}](${GITHUB_BLOB}${path.relative(REPO, inSource).split(path.sep).join('/')}${frag ? '#' + frag : ''})`;
    });
    if (out !== text) fs.writeFileSync(f, out);
  }
  return count;
}

// ── 3. injections into the dist copies ──────────────────────────────────────
function replaceBetween(file, startMarker, endMarker, generated) {
  const src = fs.readFileSync(file, 'utf8');
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s === -1 || e === -1) fail(`markers ${startMarker} missing from ${path.basename(file)}`);
  fs.writeFileSync(file, src.slice(0, s) + generated + src.slice(e + endMarker.length));
}

function injectSw(builtJs, cssBundle, moduleMap) {
  const swPath = path.join(DIST, 'service-worker.js');

  // JS precache: shell + every hashed entry/chunk. Stable-path shims are NOT
  // precached — they exist only for the testing modal (online use).
  const shell = ['./miniCycle.html', './version.js'];
  const jsList = shell.concat(builtJs.map(p => './' + p));
  replaceBetween(swPath, '// __BUILD_JS_PRECACHE_START__', '// __BUILD_JS_PRECACHE_END__',
    '// __BUILD_JS_PRECACHE_START__  (generated by scripts/build-web.cjs — hashed entries + chunks)\n' +
    'var BOOT_CRITICAL = [\n' + jsList.map(u => `  '${u}'`).join(',\n') + '\n];\n');

  // CSS precache: just the hashed bundle — critical.css is INLINED into the
  // dist HTML (rewriteHtml), so the page never fetches it; fonts.css is in CORE.
  const cssList = ['./' + cssBundle];
  replaceBetween(swPath, '// __BUILD_CSS_PRECACHE_START__', '// __BUILD_CSS_PRECACHE_END__',
    '// __BUILD_CSS_PRECACHE_START__  (generated by scripts/build-web.cjs — bundled stylesheet)\n' +
    'var CSS_FILES = [\n' + cssList.map(u => `  '${u}'`).join(',\n') + '\n];\n');

  // Module map for the synthetic version.js fallback.
  replaceBetween(swPath, '// __BUILD_MODULE_MAP_START__', '// __BUILD_MODULE_MAP_END__',
    '// __BUILD_MODULE_MAP_START__  (generated by scripts/build-web.cjs)\n' +
    'var MODULE_MAP = ' + JSON.stringify(moduleMap) + ';\n');

  return jsList.length + cssList.length;
}

function appendMapToVersionJs(moduleMap) {
  const p = path.join(DIST, 'version.js');
  fs.appendFileSync(p,
    '\n// Injected by scripts/build-web.cjs — source path → content-hashed URL.\n' +
    '// The hash IS the version: mapped URLs are used bare by the boot chain.\n' +
    'globalThis.__MC_MODULE_MAP = ' + JSON.stringify(moduleMap) + ';\n');
}

function rewriteHtml(moduleMap, cssBundle) {
  const p = path.join(DIST, 'miniCycle.html');
  let html = fs.readFileSync(p, 'utf8');
  const mainHashed = moduleMap['/miniCycle-main.js'];
  if (!mainHashed) fail('module map has no entry for /miniCycle-main.js');

  // ATTRIBUTE rewrites only — inline script content must stay byte-identical
  // (CSP hashes cover inline content, not attributes).
  const before = html;
  html = html.replace(/src="miniCycle-main\.js\?v=[0-9.]+"/, `src="${mainHashed}"`);
  html = html.replace(/styles\/main\.css\?v=[0-9.]+/g, cssBundle);
  // Drop preload hints for main.css's @import children — the bundle inlines
  // them, so these would fetch dead weight. (Whole-element removal: CSP hashes
  // only cover inline script content, which stays byte-identical.)
  html = html.replace(/[ \t]*<link rel="preload" href="styles\/[^"]+\.css\?v=[0-9.]+" as="style">\r?\n/g, '');

  // Inline critical.css into the HTML — under simulated slow-network profiles
  // the LCP was gated on this render-blocking fetch (a full extra round trip
  // before first paint). Inlining removes it; CSP allows inline STYLES
  // ('unsafe-inline' in style-src), and script hashes are unaffected. Relative
  // url()s are rebased from styles/base/ to root-absolute. Dev keeps the
  // <link> + file as the single source of truth.
  const critSrc = fs.readFileSync(path.join(WEB, 'styles/base/critical.css'), 'utf8')
    .replace(/\.\.\/\.\.\//g, '/');
  const critMin = esbuild.transformSync(critSrc, { loader: 'css', minify: true }).code.trim();
  const linkRe = /<link rel="stylesheet" href="\.\/styles\/base\/critical\.css">/;
  if (!linkRe.test(html)) fail('critical.css link tag not found for inlining');
  html = html.replace(linkRe, '<style>/* critical.css — inlined by build-web.cjs */\n' + critMin + '</style>');

  // fonts.css (930B of @font-face) is the OTHER render-blocking stylesheet —
  // same treatment. Font files themselves stay async (font-display: swap).
  const fontSrc = fs.readFileSync(path.join(WEB, 'assets/fonts/fonts.css'), 'utf8')
    .replace(/\.\//g, '/assets/fonts/');
  const fontMin = esbuild.transformSync(fontSrc, { loader: 'css', minify: true }).code.trim();
  const fontRe = /<link rel="stylesheet" href="assets\/fonts\/fonts\.css">/;
  if (!fontRe.test(html)) fail('fonts.css link tag not found for inlining');
  html = html.replace(fontRe, '<style>/* fonts.css — inlined by build-web.cjs */\n' + fontMin + '</style>');

  if (html === before) fail('HTML rewrite matched nothing — main.js/main.css references changed shape');
  fs.writeFileSync(p, html);
}

function emitShims(moduleMap, exportsByHashed) {
  // Stable-path shims so the production testing modal's direct source-path
  // imports (tests import '../modules/x.js?v=<buster>') resolve.
  //
  // QUERY-FORWARDING (v2.313): a static `export * from` shim resolved every
  // buster to the SAME hashed URL — one shared module instance, so the
  // in-browser full-suite run leaked state across suites (the ?v= buster's
  // whole job was per-suite fresh instances). These shims forward their own
  // query onto the hashed import instead: each buster yields a FRESH instance
  // of the real module. Requires explicit export lists (from the esbuild
  // metafile) because dynamic re-export can't be expressed with `export *`.
  // The app itself never fetches these files (the module map bypasses them).
  let count = 0;
  for (const [srcPath, hashed] of Object.entries(moduleMap)) {
    const names = (exportsByHashed[hashed] || []).filter(n => n !== 'default');
    const hasDefault = (exportsByHashed[hashed] || []).includes('default');
    const dest = path.join(DIST, srcPath.slice(1));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const lines = [
      `// Stable-path shim (build-web.cjs) — real module is content-hashed.`,
      `// Forwards ?v= busters so each one yields a fresh module instance (test isolation).`,
      `const m = await import('${hashed}' + new URL(import.meta.url).search);`,
    ];
    if (names.length) {
      lines.push(`let ${names.join(', ')};`);
      lines.push(`({ ${names.join(', ')} } = m);`);
      lines.push(`export { ${names.join(', ')} };`);
    }
    if (hasDefault) lines.push(`export default m.default;`);
    fs.writeFileSync(dest, lines.join('\n') + '\n');
    count++;
  }
  return count;
}

// ── runtime-import rewriter plugin ──────────────────────────────────────────
// Rewrites every runtime-computed import so that, in the bundle, it resolves
// through globalThis.__MC_MODULE_MAP (set by dist version.js):
//   - mapped hit  → hashed URL, used BARE (kills ?v=; matches precache key)
//   - map miss    → original root-absolute + original ?v= tail (defensive; the
//                   build FAILS if any manifest path lacks a map entry)
// orchestrator.js is the exception: its tail (`${vParam}`) is appended ON TOP
// of the mapped URL because boot-retry correctness needs distinct URLs.
// All forms are opaque to esbuild/minify: property access, templates with a
// real ${expr}, or ['x'].join('').
function makeRewritePlugin() {
  const toAbs = (spec, dir) => '/' + rel(path.resolve(dir, spec));
  const M = `(globalThis.__MC_MODULE_MAP||{})`;
  return {
    name: 'runtime-import-rewriter',
    setup(build) {
      build.onLoad({ filter: /\.js$/ }, (args) => {
        if (!args.path.startsWith(WEB) || args.path.includes('node_modules')) return null;
        const dir = path.dirname(args.path);
        const isOrchestrator = args.path.endsWith('modules/boot/orchestrator.js');
        let src = fs.readFileSync(args.path, 'utf8');

        // moduleManifests.js: manifest.path values feed import(withV(path)) —
        // make them root-absolute data (withV itself is map-aware).
        if (args.path.endsWith('modules/boot/moduleManifests.js')) {
          src = src.replace(/path:\s*'(\.\.?\/[^']+)'/g, (_, p) => `path: '${toAbs(p, dir)}'`);
        }

        // import(withV('REL')) → import(withV('/ABS'))  (withV resolves the map)
        src = src.replace(/withV\(\s*(['"`])(\.\.?\/[^'"`]+?)\1\s*\)/g,
          (_, q, p) => `withV(${q}${toAbs(p, dir)}${q})`);

        // import(`REL?v=${V}`) / import(`REL${tail}`)
        src = src.replace(/import\(\s*`(\.\.?\/[^`?$]+?)((?:\?|\$)[^`]*)?`\s*\)/g,
          (_, p, tail) => {
            const abs = toAbs(p, dir);
            if (isOrchestrator && tail && tail.includes('vParam')) {
              // retry-aware: mapped URL + runtime tail (distinct URLs per attempt;
              // vParam is '' on a normal map-world boot, so this stays bare then)
              return `import((${M}['${abs}'] || '${abs}') + \`${tail}\`)`;
            }
            return tail
              ? `import(${M}['${abs}'] || \`${abs}${tail}\`)`
              : `import(${M}['${abs}'] || ['${abs}'].join(''))`;
          });

        // import('REL' + expr) → map lookup with concat fallback
        src = src.replace(/import\(\s*'(\.\.?\/[^']+?)'\s*\+\s*([^)]+?)\)/g,
          (_, p, expr) => {
            const abs = toAbs(p, dir);
            return `import(${M}['${abs}'] || ('${abs}' + ${expr}))`;
          });

        // bare import('./REL.js') → map lookup with join fallback
        src = src.replace(/import\(\s*(['"])(\.\.?\/[^'"]+?\.js)\1\s*\)/g,
          (_, q, p) => {
            const abs = toAbs(p, dir);
            return `import(${M}['${abs}'] || ['${abs}'].join(''))`;
          });

        return { contents: src, loader: 'js' };
      });

      // CSS: strip ?v= from @import url('x.css?v=N.NNN') so esbuild can resolve
      // and inline them into the bundle.
      build.onLoad({ filter: /\.css$/ }, (args) => {
        if (!args.path.startsWith(WEB)) return null;
        const src = fs.readFileSync(args.path, 'utf8').replace(/(\.css)\?v=[0-9.]+/g, '$1');
        return { contents: src, loader: 'css' };
      });
    },
  };
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const jsEntries = collectEntries();
  const cssEntries = [path.join(WEB, 'styles/main.css')];
  console.log(`🧩 entries: ${jsEntries.length} JS (manifest modules + facade sub-modules + boot chain + main) + ${cssEntries.length} CSS`);

  const result = await esbuild.build({
    entryPoints: jsEntries.concat(cssEntries),
    outdir: DIST,
    outbase: WEB,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    keepNames: true,
    sourcemap: true,
    target: ['es2020'],
    entryNames: 'build/[dir]/[name]-[hash]',   // content-hashed, immutable
    chunkNames: 'build/chunks/chunk-[hash]',
    assetNames: '[dir]/[name]',                // CSS url() assets keep their real paths
    loader: {
      '.png': 'file', '.svg': 'file', '.webp': 'file', '.jpg': 'file',
      '.jpeg': 'file', '.gif': 'file', '.woff2': 'file', '.woff': 'file',
    },
    metafile: true,
    logLevel: 'warning',
    plugins: [makeRewritePlugin()],
  });

  copyStatic();
  const docs = copyDocs();

  // Module map + built-file lists from the metafile.
  const moduleMap = {};
  const exportsByHashed = {};
  let cssBundle = null;
  const builtJs = [];
  for (const [outPath, meta] of Object.entries(result.metafile.outputs)) {
    const outRel = rel(path.resolve(outPath)).replace(/^dist\//, '');
    if (outRel.endsWith('.js')) builtJs.push(outRel);
    if (!meta.entryPoint) continue;
    const srcRel = '/' + meta.entryPoint.replace(/\\/g, '/');
    if (outRel.endsWith('.css')) { cssBundle = outRel; continue; }
    if (outRel.endsWith('.js')) {
      moduleMap[srcRel] = '/' + outRel;
      exportsByHashed['/' + outRel] = meta.exports || [];
    }
  }
  if (!cssBundle) fail('CSS bundle missing from build output');

  // Gate: every manifest path and JS entry must have a map entry.
  for (const e of jsEntries) {
    const key = '/' + rel(e);
    if (!moduleMap[key]) fail(`no map entry for ${key}`);
  }

  appendMapToVersionJs(moduleMap);
  const precacheCount = injectSw(builtJs, cssBundle, moduleMap);
  rewriteHtml(moduleMap, cssBundle);
  const shimCount = emitShims(moduleMap, exportsByHashed);

  const chunkCount = builtJs.filter(p => p.startsWith('build/chunks/')).length;
  const totalBytes = Object.entries(result.metafile.outputs)
    .filter(([p]) => p.endsWith('.js'))
    .reduce((s, [, o]) => s + o.bytes, 0);
  console.log(`📦 built ${builtJs.length} hashed JS (${builtJs.length - chunkCount} entries + ${chunkCount} chunks), ${(totalBytes / 1024 / 1024).toFixed(2)}MB minified`);
  console.log(`🎨 CSS bundle: ${cssBundle}`);
  console.log(`🗺  module map: ${Object.keys(moduleMap).length} entries (appended to version.js + SW)`);
  console.log(`🧷 stable-path shims: ${shimCount} (testing modal)`);
  console.log(`🛰  SW precache regenerated: ${precacheCount} URLs`);
  console.log(`📖 docs site: ${docs.copied} file(s) published, ${docs.rewritten} link(s) repointed to GitHub (archive/future-work/incidents withheld)`);
  console.log(`✅ dist/ ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => fail(e.message));
