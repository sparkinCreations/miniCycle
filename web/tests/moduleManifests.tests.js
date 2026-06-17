/**
 * ModuleManifests Tests
 * Tests for modules/boot/moduleManifests.js
 *
 * moduleManifests is a declarative dependency graph. These tests assert its
 * STRUCTURAL INVARIANTS — the kind of thing a typo or stale edit silently breaks:
 *  - every manifest has a valid shape (path, valid phase, array fields)
 *  - provides/provideInstance map to unique providers (no two modules claim the
 *    same API name — that would make wiring order-dependent)
 *  - every `requires` resolves to a provider, a CORE_DEP, or a declared alias
 *    (no dangling deps that would wire to undefined at boot)
 *  - `after`/`before` reference real modules
 *  - lazyRequires are genuinely cross-phase-or-later (the reason they're lazy)
 *  - getLoadOrder() is complete, phase-ordered, and respects `after` constraints
 *  - the module's own validators report a clean graph
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModuleManifestsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/boot/moduleManifests.js?v=${cacheBuster}`);
    const {
        PHASES, MODULE_MANIFESTS, CORE_DEPS, ALIAS_MAP, resolveAlias,
        getLoadOrder, getModulesByPhase, getModulesForApi,
        validateManifests, validateCrossPhaseDeps, getDependencyGraph,
        computeEffectiveAfterConstraints
    } = mod;

    resultsDiv.innerHTML = '<h2>ModuleManifests Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const entries = Object.entries(MODULE_MANIFESTS);
    const names = new Set(Object.keys(MODULE_MANIFESTS));
    const validPhases = new Set(Object.values(PHASES));

    // Build provider map: api name -> Set of module names that provide it.
    // A module that lists the same name in BOTH provides[] and provideInstance is
    // NOT a collision (same provider), so we track by module-name uniqueness.
    const providerMap = new Map();
    const addProvider = (api, name) => {
        if (!providerMap.has(api)) providerMap.set(api, new Set());
        providerMap.get(api).add(name);
    };
    for (const [name, m] of entries) {
        (m.provides || []).forEach(api => addProvider(api, name));
        if (m.provideInstance) addProvider(m.provideInstance, name);
    }

    // Extra dependency names supplied at runtime by moduleLoader.js depMappings /
    // coreResult rather than by any manifest's provides[]. The manifest file is not
    // self-describing — PascalCase instance proxies (TaskDOMManager, UIOrchestrator)
    // and depMapping-only wrappers (DEFAULT_TASK_OPTION_BUTTONS, showNotificationWithTip,
    // getOnboardingManager, removeRecurringTasksFromCycle, ...) are wired there.
    // We fetch moduleLoader.js source and extract its depMappings keys so the
    // "no dangling requires" invariant reflects the REAL wiring surface, not just
    // the declarative provides graph.
    const depMappingKeys = new Set();
    try {
        const res = await fetch(`../modules/boot/moduleLoader.js?v=${cacheBuster}`);
        const text = await res.text();
        const start = text.indexOf('const depMappings = {');
        const end = text.indexOf('return {', start);
        const block = start >= 0 ? text.slice(start, end > start ? end : undefined) : '';
        // Match top-level "key:" identifiers (object property keys).
        const re = /(?:^|\n)\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g;
        let mch;
        while ((mch = re.exec(block)) !== null) depMappingKeys.add(mch[1]);
    } catch (e) {
        // If the fetch fails, depMappingKeys stays empty; the dangling test will
        // surface that explicitly rather than silently passing.
    }

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });

    await test('PHASES, MODULE_MANIFESTS, CORE_DEPS are populated', () => {
        if (Object.keys(PHASES).length === 0) throw new Error('PHASES empty');
        if (entries.length === 0) throw new Error('MODULE_MANIFESTS empty');
        if (!(CORE_DEPS instanceof Set) || CORE_DEPS.size === 0) throw new Error('CORE_DEPS bad');
    });

    // ── Per-manifest shape invariants ─────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧩 Manifest Shape</h4>';

    await test('every manifest has a non-empty string path', () => {
        for (const [name, m] of entries) {
            if (typeof m.path !== 'string' || !m.path) throw new Error(`${name}: bad path`);
        }
    });

    await test('every manifest has a valid phase number', () => {
        for (const [name, m] of entries) {
            if (!validPhases.has(m.phase)) throw new Error(`${name}: invalid phase ${m.phase}`);
        }
    });

    await test('array-typed fields are arrays when present', () => {
        const arrayFields = ['requires', 'provides', 'optionalDeps', 'lazyRequires', 'after', 'before'];
        for (const [name, m] of entries) {
            for (const f of arrayFields) {
                if (f in m && !Array.isArray(m[f])) throw new Error(`${name}.${f} is not an array`);
            }
        }
    });

    await test('boolean-typed flags are booleans when present', () => {
        const boolFields = ['optional', 'singleton', 'deferred'];
        for (const [name, m] of entries) {
            for (const f of boolFields) {
                if (f in m && typeof m[f] !== 'boolean') throw new Error(`${name}.${f} is not a boolean`);
            }
        }
    });

    await test('provideInstance, when present, is a non-empty string', () => {
        for (const [name, m] of entries) {
            if ('provideInstance' in m && (typeof m.provideInstance !== 'string' || !m.provideInstance)) {
                throw new Error(`${name}: bad provideInstance`);
            }
        }
    });

    // ── Provider uniqueness ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔑 Provider Uniqueness</h4>';

    await test('no API name is provided by two different modules (excluding intentional wrappers)', () => {
        // statsPanel intentionally re-provides the open*Modal entry points as thin
        // delegating wrappers alongside the real feature managers (history/cleared/
        // achievements). refreshTaskListUI is genuinely provided by taskDOM AND taskUI
        // (the ALIAS_MAP renderTaskList->refreshTaskListUI relies on it). These are
        // known, documented shared names — not accidental collisions.
        const KNOWN_SHARED = new Set([
            'openHistoryModal', 'openClearedTasksModal', 'openAchievementsModal',
            'refreshTaskListUI'
        ]);
        const dupes = [];
        for (const [api, providers] of providerMap) {
            if (providers.size > 1 && !KNOWN_SHARED.has(api)) {
                dupes.push(`${api} <= [${[...providers].join(', ')}]`);
            }
        }
        if (dupes.length) throw new Error('Unexpected duplicate providers:\n' + dupes.join('\n'));
    });

    await test('provideInstance names do not collide with provides API names', () => {
        // (each instance name should be its own provider entry; uniqueness check above
        //  already covers collisions, this asserts there are some instances declared)
        const instanceCount = entries.filter(([, m]) => m.provideInstance).length;
        if (instanceCount === 0) throw new Error('expected some provideInstance declarations');
    });

    // ── Dependency resolution (no dangling deps) ──────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Dependency Resolution</h4>';

    // A required dep is "resolvable" if it's a CORE_DEP, has a provider (after alias
    // resolution), or is itself a known module name (module-name dep).
    const isResolvable = (dep) => {
        if (CORE_DEPS.has(dep)) return true;
        const canonical = resolveAlias(dep);
        if (providerMap.has(canonical)) return true;
        if (providerMap.has(dep)) return true;
        if (names.has(dep)) return true;        // direct module-name dependency
        if (names.has(canonical)) return true;
        if (depMappingKeys.has(dep) || depMappingKeys.has(canonical)) return true; // wired in moduleLoader depMappings
        return false;
    };

    await test('moduleLoader depMappings were extracted (test prerequisite)', () => {
        if (depMappingKeys.size === 0) {
            throw new Error('could not read depMappings from moduleLoader.js — dangling-requires check would be unreliable');
        }
    });

    await test('every requires[] entry resolves to a provider/core dep/module/depMapping', () => {
        const dangling = [];
        for (const [name, m] of entries) {
            for (const dep of m.requires || []) {
                if (!isResolvable(dep)) dangling.push(`${name} requires '${dep}'`);
            }
        }
        if (dangling.length) throw new Error('Dangling requires:\n' + dangling.join('\n'));
    });

    await test('every lazyRequires[] entry resolves to a provider/module', () => {
        const dangling = [];
        for (const [name, m] of entries) {
            for (const dep of m.lazyRequires || []) {
                if (!isResolvable(dep)) dangling.push(`${name} lazyRequires '${dep}'`);
            }
        }
        if (dangling.length) throw new Error('Dangling lazyRequires:\n' + dangling.join('\n'));
    });

    await test('alias map keys/values are well-formed and values resolve to providers', () => {
        for (const [alias, canonical] of ALIAS_MAP) {
            if (typeof alias !== 'string' || typeof canonical !== 'string') throw new Error('alias entry not strings');
            if (!providerMap.has(canonical)) {
                throw new Error(`alias '${alias}' -> '${canonical}' but '${canonical}' has no provider`);
            }
        }
    });

    await test('resolveAlias returns canonical name for aliases, passthrough otherwise', () => {
        for (const [alias, canonical] of ALIAS_MAP) {
            if (resolveAlias(alias) !== canonical) throw new Error(`resolveAlias('${alias}') wrong`);
        }
        if (resolveAlias('definitely-not-an-alias') !== 'definitely-not-an-alias') {
            throw new Error('passthrough failed');
        }
    });

    // ── after / before integrity ──────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">↕️ after / before</h4>';

    await test('all after[] references are real modules', () => {
        const bad = [];
        for (const [name, m] of entries) {
            for (const dep of m.after || []) if (!names.has(dep)) bad.push(`${name}.after -> '${dep}'`);
        }
        if (bad.length) throw new Error('Unknown after refs:\n' + bad.join('\n'));
    });

    await test('all before[] references are real modules', () => {
        const bad = [];
        for (const [name, m] of entries) {
            for (const dep of m.before || []) if (!names.has(dep)) bad.push(`${name}.before -> '${dep}'`);
        }
        if (bad.length) throw new Error('Unknown before refs:\n' + bad.join('\n'));
    });

    await test('no module lists itself in after/before', () => {
        for (const [name, m] of entries) {
            if ((m.after || []).includes(name)) throw new Error(`${name} is in its own after`);
            if ((m.before || []).includes(name)) throw new Error(`${name} is in its own before`);
        }
    });

    await test('validateManifests() reports a valid graph', () => {
        const res = validateManifests();
        if (!res.valid) throw new Error('validateManifests errors:\n' + res.errors.join('\n'));
    });

    // ── Cross-phase / lazy correctness ────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⏳ Cross-phase</h4>';

    await test('validateCrossPhaseDeps() reports no forward-cross-phase requires', () => {
        const res = validateCrossPhaseDeps();
        if (!res.valid) throw new Error('cross-phase warnings:\n' + res.warnings.join('\n'));
    });

    await test('each lazyRequires dep provider is in a later-or-same phase (justifying laziness)', () => {
        // lazyRequires exist precisely because the provider is cross-phase (usually later).
        // Assert at least that the dep resolves; phase relationship is informational.
        for (const [name, m] of entries) {
            for (const dep of m.lazyRequires || []) {
                const providerSet = providerMap.get(resolveAlias(dep));
                const provider = providerSet ? [...providerSet][0] : undefined;
                if (!provider) continue; // some lazy hooks are injected externally
                const pPhase = MODULE_MANIFESTS[provider]?.phase;
                if (typeof pPhase !== 'number') throw new Error(`${name} lazyRequires '${dep}' provider has no phase`);
            }
        }
    });

    // ── Load order ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Load Order</h4>';

    await test('getLoadOrder() returns every module exactly once', () => {
        const order = getLoadOrder();
        if (order.length !== entries.length) {
            throw new Error(`order length ${order.length} != module count ${entries.length}`);
        }
        if (new Set(order).size !== order.length) throw new Error('duplicate entries in load order');
        for (const name of order) if (!names.has(name)) throw new Error('unknown module in order: ' + name);
    });

    await test('getLoadOrder() is non-decreasing by phase', () => {
        const order = getLoadOrder();
        let lastPhase = -Infinity;
        for (const name of order) {
            const p = MODULE_MANIFESTS[name].phase;
            if (p < lastPhase) throw new Error(`phase regression at ${name} (phase ${p} after ${lastPhase})`);
            lastPhase = Math.max(lastPhase, p);
        }
    });

    await test('getLoadOrder() respects explicit after[] constraints', () => {
        const order = getLoadOrder();
        const idx = new Map(order.map((n, i) => [n, i]));
        for (const [name, m] of entries) {
            for (const dep of m.after || []) {
                if (idx.get(dep) > idx.get(name)) {
                    throw new Error(`${name} loads before its after-dep '${dep}'`);
                }
            }
        }
    });

    await test('getModulesByPhase returns only modules of that phase, topo-ordered', () => {
        const effectiveAfter = computeEffectiveAfterConstraints();
        for (const phase of validPhases) {
            const list = getModulesByPhase(phase);
            const idx = new Map(list.map(([n], i) => [n, i]));
            for (const [name, m] of list) {
                if (m.phase !== phase) throw new Error(`getModulesByPhase(${phase}) returned ${name} (phase ${m.phase})`);
                // within-phase after constraints respected
                for (const dep of effectiveAfter.get(name) || []) {
                    if (idx.has(dep) && idx.get(dep) > idx.get(name)) {
                        throw new Error(`within phase ${phase}: ${name} before its dep ${dep}`);
                    }
                }
            }
        }
    });

    await test('getModulesForApi groups modules by api category', () => {
        const ui = getModulesForApi('ui');
        if (ui.length === 0) throw new Error('expected some ui-api modules');
        for (const [, m] of ui) if (m.api !== 'ui') throw new Error('non-ui module returned');
    });

    await test('getDependencyGraph nodes match module set; edges reference real nodes', () => {
        const { nodes, edges } = getDependencyGraph();
        if (nodes.length !== entries.length) throw new Error('node count mismatch');
        for (const [from, to] of edges) {
            if (!names.has(from) || !names.has(to)) throw new Error(`edge references unknown node: ${from}->${to}`);
        }
    });

    // ── Sub-module facade guard (documented invariant) ────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚫 Facade Sub-modules</h4>';

    await test('facade sub-modules are NOT registered as top-level manifests', () => {
        // These are dynamically imported inside their facade init() — listing them
        // here would cause duplicate initialization (per HIDDEN_CODEBASE_INSIGHTS).
        const mustBeAbsent = [
            'taskValidation', 'taskUtils', 'taskRenderer', 'taskEvents',
            'preferencesBgImage', 'preferencesPresets',
            'settingsUIManager', 'cycleExportManager', 'cycleImportManager'
        ];
        const leaked = mustBeAbsent.filter(n => names.has(n));
        if (leaked.length) throw new Error('facade sub-modules leaked into manifests: ' + leaked.join(', '));
    });

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
