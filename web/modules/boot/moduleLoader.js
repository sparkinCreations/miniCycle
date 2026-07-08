/**
 * @file moduleLoader.js
 * @description Module loader that uses manifests for loading
 * @module modules/boot/moduleLoader
 *
 * This module provides utilities for loading modules based on their manifests.
 * It handles:
 * - Loading modules by phase
 * - Calling setDependencies functions
 * - Initializing modules
 * - Registering with appContext
 *
 * USAGE:
 * ```javascript
 * import { loadPhase, loadAllModules } from './moduleLoader.js';
 *
 * // Load a specific phase
 * await loadPhase(deps, coreResult, PHASES.CORE_UTILS);
 *
 * // Or load all phases
 * await loadAllModules(deps, coreResult);
 * ```
 *
 * @version 1.0.0
 */

// ✅ FIX: Dynamic import with version for cache-busting (prevents stale manifest issues)
// Static imports can serve cached old versions even when moduleLoader.js is updated
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { featureAvailability } from '../utils/featureAvailability.js';

let MODULE_MANIFESTS = {};
let PHASES = {};
let getModulesByPhase = () => [];
let getLoadOrder = () => [];
let validateCrossPhaseDeps = () => ({ valid: true, warnings: [] });

// Re-export for consumers (will be populated after loadManifests())
export { MODULE_MANIFESTS, PHASES, getLoadOrder };

let _manifestsLoaded = false;
let _depMappingKeys = null; // Populated after loadAllModules — used by DI wiring tests

// ============================================================================
// APPCONTEXT DYNAMIC IMPORT
// ============================================================================
// IMPORTANT: Must use versioned import to match coreBoot's instance
// (unversioned and versioned imports are different modules with separate state)
let _appContextModule = null;
let _withV = null;
let registerApi = () => { console.warn('⚠️ registerApi not loaded yet'); };

// Use grouped APIs instead of legacy getters
const getCompleteInitialSetup = () => _appContextModule?.getContextValue?.('completeInitialSetup') || null;
const getHideMainMenu = () => _appContextModule?.getUiApi?.()?.hideMainMenu || null;

async function loadAppContext(withV) {
    // Store withV for future use if provided
    if (withV) _withV = withV;

    if (!_appContextModule && _withV) {
        // Use versioned import to match coreBoot's appContext instance
        _appContextModule = await import(_withV('../core/appContext.js'));
        registerApi = _appContextModule.registerApi;
    }
    return _appContextModule;
}

// Note: Early non-blocking import removed - must wait for withV from coreBoot
// to ensure we get the same appContext instance where completeInitialSetup is set

/**
 * Load moduleManifests with version cache-busting
 * @param {Function} withV - Version-appending function from coreBoot (e.g., path => `${path}?v=1.528`)
 */
export async function loadManifests(withV) {
    if (_manifestsLoaded) return;

    const manifestModule = await import(withV('./moduleManifests.js'));
    MODULE_MANIFESTS = manifestModule.MODULE_MANIFESTS;
    PHASES = manifestModule.PHASES;
    getModulesByPhase = manifestModule.getModulesByPhase;
    getLoadOrder = manifestModule.getLoadOrder;
    validateCrossPhaseDeps = manifestModule.validateCrossPhaseDeps;

    // Load shared constants from versioned manifest (single source of truth)
    CORE_DEPS = manifestModule.CORE_DEPS;
    ALIAS_MAP = manifestModule.ALIAS_MAP;
    resolveAlias = manifestModule.resolveAlias;

    _manifestsLoaded = true;

    // Also load appContext with versioning (must match coreBoot's instance)
    await loadAppContext(withV);

}

// ============================================================================
// MODULE LOADING STATE
// ============================================================================
// ⚠️ The registries MUST be shared across ALL moduleLoader instances. On boot
// retry the orchestrator imports moduleLoader with a DIFFERENT ?v= suffix
// (?v=X.r2, or bare offline), which creates a separate ES module instance —
// module-level Maps there would start empty, so destroyAllModules() would
// iterate nothing and attempt 1's listeners/timers would survive into attempt 2
// (July 2026 boot audit, finding C1). Anchoring the Maps on globalThis gives
// one registry per page, the same cross-instance strategy as featureBoot's
// HTML event bridge. This is deliberate boot infrastructure — NOT a precedent
// for window.* globals in feature modules.

const _registryHost = globalThis.__miniCycleModuleRegistry =
    globalThis.__miniCycleModuleRegistry || {
        loadedModules: new Map(),
        moduleInstances: new Map()
    };
const loadedModules = _registryHost.loadedModules;
const moduleInstances = _registryHost.moduleInstances;

// ============================================================================
// BOOT GENERATION GUARD
// ============================================================================
// A phase that times out is NOT cancelled — withTimeout() only rejects the
// race. The zombie attempt keeps importing/wiring modules concurrently with
// the retry, writing stale instances into the shared deps container (July 2026
// boot audit, finding C2). The orchestrator bumps
// globalThis.__miniCycleBootGeneration at the start of every boot attempt;
// loaders capture their generation and abort at the next checkpoint once
// superseded. All checks no-op when the global is undefined (unit tests).

let _bootGeneration; // generation captured by loadAllModules for this instance

// Exported for tests (moduleLoader.tests.js pins the supersede contract).
export function assertBootGenerationCurrent(myGeneration) {
    const current = globalThis.__miniCycleBootGeneration;
    if (current !== undefined && myGeneration !== undefined && current !== myGeneration) {
        throw new Error(
            `Boot attempt superseded (generation ${myGeneration} → ${current}) — aborting stale boot work`
        );
    }
}

// ============================================================================
// DEFERRED (ON-DEMAND) MODULE LOADING
// ============================================================================
// Modules with `deferred: true` in their manifest are SKIPPED at boot and
// loaded lazily on first use via ensureModuleLoaded(). This keeps their parse +
// init() off the critical boot path. loadAllModules() captures the boot context
// (deps + coreResult) here so on-demand loads after boot can reuse it.
let _bootDeps = null;
let _bootCoreResult = null;

// ============================================================================
// SHARED CONSTANTS (loaded from versioned moduleManifests.js)
// ============================================================================
// These are populated by loadManifests() to avoid versioned/unversioned cache mismatches.
// The constants live in moduleManifests.js as the single source of truth.
let CORE_DEPS = new Set();  // Will be populated from manifest
let ALIAS_MAP = new Map();  // Will be populated from manifest
let resolveAlias = (apiName) => apiName;  // Will be populated from manifest

// ============================================================================
// CIRCULAR DEPENDENCY DETECTION
// ============================================================================

/**
 * Enable strict mode for lazy validation (throws instead of warns).
 * Set to true during development to catch missing providers early.
 */
const STRICT_LAZY_VALIDATION = false;

/**
 * Enable audit mode to log when modules access undeclared dependencies.
 * Use this to find missing `requires` entries before enabling ENFORCE_REQUIRES.
 *
 * NOTE: Currently generates many false positives due to property enumeration
 * (DevTools logging, Object.keys, etc.). Only enable for targeted debugging.
 */
const AUDIT_UNDECLARED_DEPS = false;

/**
 * When true, modules ONLY receive dependencies declared in `requires`.
 * This is a breaking change - enable only after all modules have complete `requires`.
 * Use AUDIT_UNDECLARED_DEPS=true first to find missing entries.
 */
const ENFORCE_REQUIRES = false;

/**
 * When true, log a warning at boot for any dep declared in a manifest's
 * `requires`/`optionalDeps`/`lazyRequires` that is NOT in `depMappings` and NOT
 * in `CORE_DEPS`. This catches the silent-failure bug class where a consumer's
 * `optional()` default sentinel is used forever because nothing wired the dep.
 *
 * High-signal: each warning corresponds to a real missing wiring entry. The
 * AUDIT_UNDECLARED_DEPS flag above catches the OPPOSITE direction (deps used
 * but not declared) and has many false positives — this one doesn't.
 *
 * Default ON in development. Set false to suppress.
 */
const WARN_ON_UNMAPPED_DECLARED_DEPS = true;
// Dedupe DI-gap warnings — buildModuleDependencies re-runs on deferred loads,
// so without this each gap spams the console once per wiring pass.
const _warnedDIGaps = new Set();

/**
 * Create a validated lazy wrapper that warns/throws on null provider access.
 * This catches missing dependencies at call time instead of silently returning undefined.
 *
 * @param {string} apiName - Name of the API for logging
 * @param {Function} getter - Function that returns the actual implementation
 * @returns {Function} - Wrapper that validates before calling
 */
function createValidatedWrapper(apiName, getter) {
    let hasWarned = false;

    return (...args) => {
        const impl = getter();

        if (impl === undefined || impl === null) {
            if (!hasWarned) {
                const msg = `Lazy dep '${apiName}' resolved to null at call time`;
                if (STRICT_LAZY_VALIDATION) {
                    throw new Error(msg);
                }
                console.warn(`⚠️ ${msg}`);
                hasWarned = true;
            }
            return undefined;
        }

        return impl(...args);
    };
}

/**
 * Find which module provides a given API
 * @param {string} apiName - API name to find
 * @param {Object} manifests - MODULE_MANIFESTS object
 * @returns {string|null} - Module name that provides this API, or null
 */
function findProviderModule(apiName, manifests) {
    // First resolve any alias to canonical name
    const canonical = resolveAlias(apiName);

    for (const [name, manifest] of Object.entries(manifests)) {
        if (manifest.provides?.includes(canonical)) {
            return name;
        }
        // Also check provideInstance
        if (manifest.provideInstance === canonical) {
            return name;
        }
    }
    return null;
}

/**
 * Build a dependency graph from module manifests
 * @param {Object} manifests - MODULE_MANIFESTS object
 * @returns {Map<string, Set<string>>} - Adjacency list of dependencies
 */
function buildDependencyGraph(manifests) {
    const graph = new Map();

    for (const [name, manifest] of Object.entries(manifests)) {
        const deps = new Set();

        // Build dependencies from 'requires' field (maps API names to module names)
        if (manifest.requires && Array.isArray(manifest.requires)) {
            manifest.requires.forEach(apiName => {
                // Skip core deps - they're always available from coreBoot
                if (CORE_DEPS.has(apiName)) return;

                const provider = findProviderModule(apiName, manifests);
                if (provider && provider !== name) {
                    deps.add(provider);
                }
            });
        }

        // Also include explicit 'after' constraints
        if (manifest.after && Array.isArray(manifest.after)) {
            manifest.after.forEach(dep => deps.add(dep));
        }

        graph.set(name, deps);
    }

    return graph;
}

/**
 * Detect circular dependencies using DFS with cycle detection
 * @param {Map<string, Set<string>>} graph - Dependency graph
 * @returns {Array<Array<string>>} - Array of cycles found (each cycle is an array of module names)
 */
function findCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    function dfs(node) {
        if (recursionStack.has(node)) {
            // Found a cycle - extract it from the path
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart).concat(node);
            cycles.push(cycle);
            return;
        }

        if (visited.has(node)) {
            return;
        }

        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const deps = graph.get(node) || new Set();
        for (const dep of deps) {
            if (graph.has(dep)) { // Only check deps that are in our manifest
                dfs(dep);
            }
        }

        path.pop();
        recursionStack.delete(node);
    }

    // Run DFS from each node
    for (const node of graph.keys()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    return cycles;
}

/**
 * Detect and report circular dependencies in module manifests
 * Should be called before loading modules
 * @param {Object} manifests - MODULE_MANIFESTS object
 * @returns {boolean} - True if no cycles found, false if cycles exist
 */
export function detectCircularDeps(manifests) {

    const graph = buildDependencyGraph(manifests);
    const cycles = findCycles(graph);

    if (cycles.length > 0) {
        console.error('🔄 Circular dependencies detected!');
        cycles.forEach((cycle, i) => {
            console.error(`  Cycle ${i + 1}: ${cycle.join(' → ')}`);
        });
        console.warn('⚠️ Circular dependencies may cause initialization issues.');
        return false;
    }

    return true;
}

// ============================================================================
// CORE LOADER
// ============================================================================

/**
 * Load a single module by name
 * @param {string} name - Module name from manifests
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @param {Function} withV - Version-appending function for cache busting
 * @returns {Promise<Object|null>} Loaded module or null if failed
 */
export async function loadModule(name, deps, coreResult, withV, wire = true) {
    // ✅ Ensure manifests are loaded (idempotent - only loads once)
    if (!_manifestsLoaded) {
        await loadManifests(withV);
    }

    if (loadedModules.has(name)) {
        return loadedModules.get(name);
    }

    const manifest = MODULE_MANIFESTS[name];
    if (!manifest) {
        console.warn(`⚠️ Unknown module: ${name}`);
        return null;
    }

    try {

        // Import the module
        const mod = await import(withV(manifest.path));
        loadedModules.set(name, mod);

        // Wire dependencies (setDependencies). Skipped when wire=false: loadPhase defers
        // wiring to its sequential init stage, because setDependencies EAGERLY captures
        // getter-style deps (e.g. TaskOptionsVisibilityController) — so a module must wire
        // AFTER same-phase providers' init() has registered them, not during parallel load.
        if (wire) {
            const setDepsFn = findSetDependenciesFunction(mod, name);
            if (setDepsFn) {
                const moduleDeps = buildModuleDependencies(manifest, deps, coreResult);
                setDepsFn(moduleDeps);
            }
        }

        return mod;
    } catch (error) {
        if (manifest.optional) {
            console.warn(`⚠️ Optional module ${name} failed to load:`, error.message);
            featureAvailability.markFailed(name, error);
            return null;
        }
        console.error(`❌ Failed to load ${name}:`, error);
        throw error;
    }
}

/**
 * Initialize a loaded module
 * @param {string} name - Module name
 * @param {Object} mod - Loaded module
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Promise<Object|null>} Initialized instance or null
 */
export async function initializeModule(name, mod, deps, coreResult) {
    if (moduleInstances.has(name)) {
        return moduleInstances.get(name);
    }

    const manifest = MODULE_MANIFESTS[name];
    if (!manifest) return null;

    try {
        // Look for init function
        const initFn = findInitFunction(mod, name);
        if (initFn) {
            const initDeps = buildModuleDependencies(manifest, deps, coreResult);
            const instance = await initFn(initDeps);
            moduleInstances.set(name, instance);

            // Register provides in deps container
            // Pass both instance and raw module - instance is checked first, then module exports as fallback
            if (manifest.provides && instance) {
                registerProvides(name, manifest, instance, deps, mod);
            }

            // Register instance itself if provideInstance is specified
            if (manifest.provideInstance && instance) {
                const category = getDepsCategoryForModule(manifest);
                if (deps[category]) {
                    deps[category][manifest.provideInstance] = instance;
                }
            }

            return instance;
        }

        // No init function - module is just a collection of exports
        // Still register provides from the raw module exports
        if (manifest.provides) {
            registerProvides(name, manifest, mod, deps);
        }

        // Register the instance under provideInstance for no-init modules too —
        // previously only the init-fn branch did this, so a no-init module's
        // provideInstance silently never registered (July 2026 boot audit, C3).
        if (manifest.provideInstance && mod[manifest.provideInstance]) {
            const category = getDepsCategoryForModule(manifest);
            if (deps[category]) {
                deps[category][manifest.provideInstance] = mod[manifest.provideInstance];
            }
        }

        // Check for exported instances that have init() methods (e.g., onboardingManager)
        // These are pre-created singletons that need initialization after dependencies are set.
        // Any singleton exposing destroy() is registered in moduleInstances so
        // destroy-on-retry reaches its listeners/timers — previously no-init modules
        // (e.g. dailyResetManager) were invisible to destroyAllModules() (audit C3).
        if (manifest.provides || manifest.provideInstance) {
            const probeNames = [...(manifest.provides || [])];
            if (manifest.provideInstance) probeNames.push(manifest.provideInstance);
            const destroyables = [];
            for (const provided of new Set(probeNames)) {
                const exportedInstance = mod[provided];
                if (!exportedInstance || typeof exportedInstance !== 'object') continue;
                if (typeof exportedInstance.init === 'function' && !exportedInstance.initialized) {
                    try {
                        await exportedInstance.init();
                    } catch (initError) {
                        console.warn(`⚠️ ${name}.${provided}.init() failed:`, initError.message);
                    }
                }
                if (typeof exportedInstance.destroy === 'function' && !destroyables.includes(exportedInstance)) {
                    destroyables.push(exportedInstance);
                }
            }
            if (destroyables.length && !moduleInstances.has(name)) {
                moduleInstances.set(
                    name,
                    destroyables.length === 1 ? destroyables[0] : {
                        destroy() {
                            for (const d of destroyables) {
                                try { d.destroy(); } catch (e) { console.warn(`[moduleLoader] destroy() failed for ${name} singleton:`, e); }
                            }
                        }
                    }
                );
            }
        }

        return mod;
    } catch (error) {
        if (manifest.optional) {
            console.warn(`⚠️ Optional module ${name} failed to initialize:`, error.message);
            featureAvailability.markFailed(name, error);
            return null;
        }
        console.error(`❌ Failed to initialize ${name}:`, error);
        throw error;
    }
}

// ============================================================================
// PHASE LOADING
// ============================================================================

/**
 * Load all modules in a specific phase
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @param {number} phase - Phase number to load
 * @returns {Promise<Map<string, Object>>} Map of loaded modules
 */
export async function loadPhase(deps, coreResult, phase) {
    const { withV } = coreResult;
    const myGeneration = globalThis.__miniCycleBootGeneration;

    // ✅ Ensure manifests are loaded (idempotent - only loads once)
    if (!_manifestsLoaded) {
        await loadManifests(withV);
    }
    const modules = getModulesByPhase(phase);
    const results = new Map();

    // Non-deferred modules, in the manifest's dependency order. Deferred modules
    // load on-demand via ensureModuleLoaded().
    const active = modules.filter(([, manifest]) => !manifest.deferred);

    // ⚡ Stage 1 — FETCH (import + parse) in parallel. This is the boot-time win: it
    // collapses N sequential fetch/parse round-trips into one batch. NO wiring here —
    // import() is order-independent/idempotent, but setDependencies is NOT (it eagerly
    // captures getter-style cross-module deps), so wiring is deferred to Stage 2.
    // A non-optional import failure rejects here, aborting boot exactly as before
    // (optional modules resolve to null inside loadModule).
    await Promise.all(
        active.map(([name]) => loadModule(name, deps, coreResult, withV, /* wire */ false))
    );

    // ⚡ Stage 2 — WIRE + INITIALIZE sequentially, in dependency order. setDependencies
    // runs HERE (after each earlier module's init() has registered its provides), so a
    // module captures same-phase providers correctly — identical semantics to the
    // original per-module sequential loop, with ONLY the import parallelized.
    for (const [name, manifest] of active) {
        // Checkpoint: if a retry superseded this attempt while we were awaiting
        // the previous module's init, stop before wiring anything else stale.
        assertBootGenerationCurrent(myGeneration);

        const mod = loadedModules.get(name);
        if (!mod) continue; // optional import failed → skip

        const setDepsFn = findSetDependenciesFunction(mod, name);
        if (setDepsFn) {
            setDepsFn(buildModuleDependencies(manifest, deps, coreResult));
        }

        const instance = await initializeModule(name, mod, deps, coreResult);
        results.set(name, instance || mod);
    }

    return results;
}

/**
 * Load all modules in correct order
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Promise<Object>} All loaded modules and instances
 */
export async function loadAllModules(deps, coreResult) {
    const { appInit, withV } = coreResult;

    // Capture boot context so deferred modules can be loaded on-demand after boot.
    _bootDeps = deps;
    _bootCoreResult = coreResult;
    _bootGeneration = globalThis.__miniCycleBootGeneration;

    // ✅ FIX: Load manifests with version cache-busting BEFORE using any manifest data
    // This prevents stale cached manifests from causing 404s on moved/renamed modules
    await loadManifests(withV);

    // ✅ Check for circular dependencies before loading
    detectCircularDeps(MODULE_MANIFESTS);

    // ✅ Validate cross-phase dependencies (warns about undeclared lazyRequires)
    validateCrossPhaseDeps();

    // Ensure core systems (AppState, Schema 2.5 data) are ready before loading modules
    if (appInit && !appInit.isCoreReady()) {
        await appInit.waitForCore();
    }

    const results = {
        modules: new Map(),
        instances: new Map(),
        apis: {}
    };

    // Load each phase in order.
    // ⏱️ Per-phase timing: emit a `mc:subphase:<NAME>` performance measure for each
    // phase so getBootTiming() can rank which phase dominates the features window
    // (the proven 74–78% of boot). Measures are read by name in orchestrator.js —
    // see clearBootTiming()/getBootTiming() for the matching prefix scan.
    for (const [phaseName, phase] of Object.entries(PHASES)) {
        // Checkpoint: abort between phases if a retry superseded this attempt.
        assertBootGenerationCurrent(_bootGeneration);
        const startMark = `mc:subphase:${phaseName}:start`;
        try { performance.mark(startMark); } catch (_) { /* perf API unavailable */ }
        const phaseResults = await loadPhase(deps, coreResult, phase);
        // 2-arg measure: startMark → now. Swallows if the mark is missing.
        try { performance.measure(`mc:subphase:${phaseName}`, startMark); } catch (_) { /* mark missing */ }
        for (const [name, result] of phaseResults) {
            results.modules.set(name, loadedModules.get(name));
            results.instances.set(name, result);
        }
    }

    // Build grouped APIs
    results.apis = buildGroupedApis(deps);

    // Cross-module injections (run at boot; re-run after each on-demand load).
    runPostInitInjections(deps);

    return results;
}

/**
 * Cross-module injections that must run after the relevant modules exist.
 * Called once at the end of boot, and again after each on-demand (deferred)
 * module load, so a late-arriving provider gets wired into already-loaded
 * consumers. Every injection is guarded — a safe no-op until both sides exist.
 * @param {Object} deps - Dependencies container
 */
function runPostInitInjections(deps) {
    // Inject taskOptionsCustomizer into taskDOMManager (required for three-dots menu)
    if (deps.task?.taskDOMManager && deps.ui?.taskOptionsCustomizer) {
        if (typeof deps.task.taskDOMManager.injectDependency === 'function') {
            deps.task.taskDOMManager.injectDependency('taskOptionsCustomizer', deps.ui.taskOptionsCustomizer);
        }
    }

    // Inject enableDragAndDropOnTask into taskDOMManager (required for long-press after refresh)
    if (deps.task?.taskDOMManager && deps.task?.enableDragAndDropOnTask) {
        if (typeof deps.task.taskDOMManager.injectDependency === 'function') {
            deps.task.taskDOMManager.injectDependency('enableDragAndDropOnTask', deps.task.enableDragAndDropOnTask);
        }
    }

    // Inject updateSearchVisibility into TaskRenderer (for task search visibility)
    if (deps.task?.taskDOMManager?.renderer && deps.ui?.updateSearchVisibility) {
        if (typeof deps.task.taskDOMManager.renderer.injectDependency === 'function') {
            deps.task.taskDOMManager.renderer.injectDependency('updateSearchVisibility', deps.ui.updateSearchVisibility);
        }
    }

    // Inject completed-tasks wiring into TaskRenderer.
    // - completedTasksManager instance: lets renderTasks project BOTH lists from state during
    //   the atomic swap (isEnabled / prepareCompletedNode / updateCount) — render-path unification.
    // - organizeCompletedTasks: retained for patch renders (undo/redo) that move nodes in place.
    if (deps.task?.taskDOMManager?.renderer && deps.ui?.completedTasksManager) {
        if (typeof deps.task.taskDOMManager.renderer.injectDependency === 'function') {
            deps.task.taskDOMManager.renderer.injectDependency('completedTasksManager',
                deps.ui.completedTasksManager
            );
            deps.task.taskDOMManager.renderer.injectDependency('organizeCompletedTasks',
                () => deps.ui.completedTasksManager.organize?.()
            );
        }
    }
}

/**
 * Load a DEFERRED module on-demand (after boot) and register its provides.
 * Idempotent — a module loaded once is cached and never re-fetched. Any deferred
 * prerequisites (manifest `after` + deferred `requires` providers) are loaded
 * first so this module's setDependencies sees them populated. Consumers reach
 * the new provides through the existing lazy depMappings wrappers, so nothing
 * needs rewiring.
 * @param {string} name - Module name from manifests
 * @returns {Promise<Object|null>} The module instance (or raw module), or null.
 */
export async function ensureModuleLoaded(name) {
    if (moduleInstances.has(name)) return moduleInstances.get(name);
    // A stale moduleLoader instance from a superseded boot attempt must not
    // wire a deferred module with its outdated _bootDeps/_bootCoreResult.
    assertBootGenerationCurrent(_bootGeneration);
    if (!_bootDeps || !_bootCoreResult) {
        console.warn(`⚠️ ensureModuleLoaded('${name}') called before boot captured context`);
        return null;
    }
    const manifest = MODULE_MANIFESTS[name];
    if (!manifest) {
        console.warn(`⚠️ ensureModuleLoaded: unknown module '${name}'`);
        return null;
    }

    // Resolve deferred prerequisites first (explicit `after` + providers of `requires`).
    const prereqs = new Set(manifest.after || []);
    for (const req of manifest.requires || []) {
        const provider = findDeferredProvider(req);
        if (provider) prereqs.add(provider);
    }
    for (const dep of prereqs) {
        if (dep !== name && MODULE_MANIFESTS[dep]?.deferred && !moduleInstances.has(dep)) {
            await ensureModuleLoaded(dep);
        }
    }

    const { withV } = _bootCoreResult;
    const mod = await loadModule(name, _bootDeps, _bootCoreResult, withV);
    if (!mod) return null;
    const instance = await initializeModule(name, mod, _bootDeps, _bootCoreResult);
    // Wire the new provider into already-loaded consumers.
    runPostInitInjections(_bootDeps);
    return instance ?? mod;
}

/**
 * Find which module provides a given API name (provides[] or provideInstance).
 * Used by ensureModuleLoaded to resolve deferred prerequisites.
 * @param {string} apiName
 * @returns {string|null} Module name, or null if no manifest provides it.
 */
function findDeferredProvider(apiName) {
    const canonical = resolveAlias(apiName);
    for (const [mName, m] of Object.entries(MODULE_MANIFESTS)) {
        if (m.provideInstance === canonical) return mName;
        if (m.provides?.includes(canonical)) return mName;
    }
    return null;
}

/**
 * Invoke a provide from a DEFERRED module, loading the module first if needed.
 * Used inside depMappings for entry points triggered purely via DI (e.g.
 * gamesManager.unlockMiniGame from a cycle milestone). If the provide already
 * resolves it's called synchronously (return value preserved). Otherwise the
 * module loads on-demand and the call runs after — fire-and-forget friendly
 * (returns a Promise callers may ignore).
 *
 * Only use this for entry points that represent genuine user-intent moments —
 * NOT for hot-path or boot-time calls, or the module would load eagerly anyway.
 * @param {string} moduleName - Deferred module to ensure
 * @param {Function} resolve - Returns the resolved provide fn (or undefined)
 * @param {Array} args - Arguments to pass to the provide
 */
function deferredInvoke(moduleName, resolve, args) {
    const fn = resolve();
    if (typeof fn === 'function') return fn(...args);
    return ensureModuleLoaded(moduleName).then(() => {
        const f = resolve();
        return typeof f === 'function' ? f(...args) : undefined;
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the setDependencies function for a module
 * @param {Object} mod - Loaded module
 * @param {string} name - Module name
 * @returns {Function|null}
 */
function findSetDependenciesFunction(mod, name) {
    // Try common naming patterns
    const patterns = [
        `set${capitalize(name)}Dependencies`,
        'setDependencies',
        'setModuleDependencies'
    ];

    for (const pattern of patterns) {
        if (typeof mod[pattern] === 'function') {
            return mod[pattern];
        }
    }

    // Look for any function starting with 'set' and ending with 'Dependencies'
    for (const key of Object.keys(mod)) {
        if (key.startsWith('set') && key.endsWith('Dependencies') && typeof mod[key] === 'function') {
            return mod[key];
        }
    }

    return null;
}

/**
 * Find the init function for a module
 * @param {Object} mod - Loaded module
 * @param {string} name - Module name
 * @returns {Function|null}
 */
function findInitFunction(mod, name) {
    // Try common naming patterns
    const patterns = [
        `init${capitalize(name)}`,
        `initialize${capitalize(name)}`,
        'init',
        'initialize'
    ];

    for (const pattern of patterns) {
        if (typeof mod[pattern] === 'function') {
            return mod[pattern];
        }
    }

    // Also search for any exported function starting with 'init' or 'initialize'
    // This handles cases like initTaskValidator for module taskValidation
    for (const key of Object.keys(mod)) {
        if ((key.startsWith('init') || key.startsWith('initialize')) &&
            typeof mod[key] === 'function' &&
            key !== 'initDependencies') {  // Skip dependency setters
            return mod[key];
        }
    }

    return null;
}

/**
 * Inject a module's declared dependencies into `result`.
 *
 * All three declaration buckets — requires, optionalDeps, lazyRequires — are
 * resolved identically (from depMappings, falling back to coreResult) so they
 * all survive ENFORCE_REQUIRES mode. Under the default loader they're also
 * supplied by the broad `Object.assign(result, depMappings)`, but that assign is
 * skipped when ENFORCE_REQUIRES is true; this is then the only path, and omitting
 * optionalDeps here (as the loader previously did) would make every optional dep
 * silently resolve to undefined the moment the flag flips.
 *
 * Caller validates requires/lazyRequires separately; optionalDeps are not
 * validated (they're allowed to be absent). Exported for unit testing the
 * strict-mode injection path.
 *
 * @param {Object} result - Dependency object being assembled (mutated in place)
 * @param {Object} manifest - Module manifest (reads requires/optionalDeps/lazyRequires)
 * @param {Object} depMappings - Map of dep name → resolver
 * @param {Object} coreResult - Phase-1 boot results, used as a fallback source
 * @returns {Object} the same `result`, for chaining
 */
export function injectDeclaredDeps(result, manifest, depMappings, coreResult) {
    const declared = [
        ...(manifest.requires || []),
        ...(manifest.optionalDeps || []),
        ...(manifest.lazyRequires || []),
    ];
    for (const dep of declared) {
        if (dep in depMappings) {
            result[dep] = depMappings[dep];
        } else if (coreResult && dep in coreResult) {
            result[dep] = coreResult[dep];
        }
    }
    return result;
}

/**
 * Inject framework-level CORE_DEPS into `result`.
 *
 * CORE_DEPS are always available and never declared in a manifest. They come
 * from two sources: a handful (AppState, appInit, GlobalUtils, AppGlobalState,
 * FeatureFlags, AppMeta) are set directly on `result` by the Phase-1 prologue of
 * buildModuleDependencies; the rest (DOM helpers, sanitizeInput, generateId, the
 * safe* utilities, …) are entries in `depMappings`. Under the default loader the
 * latter arrive via the broad `Object.assign(result, depMappings)`, but that
 * assign is skipped under ENFORCE_REQUIRES — so without this loop every
 * depMappings-sourced CORE_DEP (e.g. getElementById) would be undefined in strict
 * mode and modules using it would break.
 *
 * Only CORE_DEPS that are depMappings keys are touched; the Phase-1 ones are NOT
 * depMappings keys, so this never overwrites the AppState Proxy or its siblings.
 * Behavior-neutral under ENFORCE_REQUIRES=false (the broad assign re-applies the
 * identical values immediately after). Exported for unit testing.
 *
 * @param {Object} result - Dependency object being assembled (mutated in place)
 * @param {Set<string>|Iterable<string>} coreDeps - The CORE_DEPS set
 * @param {Object} depMappings - Map of dep name → resolver
 * @returns {Object} the same `result`, for chaining
 */
export function injectCoreDeps(result, coreDeps, depMappings) {
    for (const coreDep of coreDeps) {
        if (coreDep in depMappings) {
            result[coreDep] = depMappings[coreDep];
        }
        // CORE_DEPS not in depMappings are Phase-1 boot deps (AppState, appInit,
        // …) already set on `result` before this runs — intentionally left alone.
    }
    return result;
}

/**
 * Build dependencies object for a module based on its manifest
 * @param {Object} manifest - Module manifest
 * @param {Object} deps - Dependencies container
 * @param {Object} coreResult - Results from coreBoot
 * @returns {Object}
 */
function buildModuleDependencies(manifest, deps, coreResult) {
    const { GlobalUtils, appInit, AppGlobalState, FeatureFlags } = coreResult;
    const result = {};

    // Add core dependencies
    result.appInit = appInit;
    result.GlobalUtils = GlobalUtils;
    result.AppGlobalState = AppGlobalState;
    result.FeatureFlags = FeatureFlags;
    result.AppMeta = deps.core?.AppMeta;
    // AppState: callable Proxy that works both as function and object
    // - this.deps.AppState() returns the AppState object (for settingsManager, etc.)
    // - this.deps.AppState?.isReady?.() works via property access (for taskCore, etc.)
    // - this.deps.AppState.data = x works via property assignment (for cycleManager, etc.)
    const appStateGetter = () => deps.core?.AppState;
    // Methods the codebase calls on AppState. When the underlying manager is not
    // yet available (boot retry / teardown), accessing any of these must yield a
    // SAFE NO-OP function rather than `undefined` — otherwise `AppState?.get()`
    // throws "AppState?.get is not a function" (the `?.` can't short-circuit a
    // truthy Proxy), which crashes the boot-error renderer and the global error
    // handler and produces a blank white screen. Returning `() => undefined`
    // honors the `if (!state) ...` guards that already exist at ~50 call sites.
    const APPSTATE_SAFE_METHODS = new Set([
        'get', 'update', 'subscribe', 'unsubscribe', 'isReady', 'forceSave',
        'set', 'reload', 'init', 'destroy', 'save', '_initializeInternal'
    ]);
    result.AppState = new Proxy(appStateGetter, {
        get(target, prop) {
            if (prop === 'apply' || prop === 'call' || prop === 'bind') {
                return target[prop].bind(target);
            }
            // Proxy property access to the actual AppState
            // Must bind methods to preserve 'this' context when called
            const appState = deps.core?.AppState;
            if (!appState) {
                // Not ready: method-style access becomes a safe no-op (returns
                // undefined when called); property reads (data, saveTimeout, …)
                // resolve to undefined, which all consumers treat as falsy.
                return APPSTATE_SAFE_METHODS.has(prop) ? () => undefined : undefined;
            }
            const value = appState[prop];
            if (typeof value === 'function') {
                return value.bind(appState);
            }
            return value;
        },
        set(target, prop, value) {
            // Proxy property assignment to the actual AppState
            const appState = deps.core?.AppState;
            if (appState) {
                appState[prop] = value;
                return true;
            }
            // Fix #46: Return true to avoid TypeError in strict mode
            // Log warning since AppState isn't ready yet
            console.warn(`⚠️ AppState proxy: Cannot set "${prop}" - AppState not initialized yet`);
            return true;
        },
        apply(target, thisArg, args) {
            // Allow function call: this.deps.AppState()
            return target();
        }
    });

    // Map common dependencies from deps container
    const depMappings = {
        // Core
        loadMiniCycleData: () => deps.core?.loadMiniCycleData?.(),
        autoSave: () => deps.core?.autoSave?.(),
        updateCycleData: (...args) => deps.core?.updateCycleData?.(...args),
        assignCycleVariables: () => deps.core?.assignCycleVariables?.(),

        // Utils
        showNotification: deps.utils?.showNotification,
        showNotificationWithTip: deps.utils?.showNotificationWithTip,
        notifications: deps.utils?.notifications,
        showConfirmationModal: deps.utils?.showConfirmationModal,
        showChoiceModal: deps.utils?.showChoiceModal,
        showPromptModal: deps.utils?.showPromptModal,
        sanitizeInput: deps.utils?.sanitizeInput || GlobalUtils?.sanitizeInput,
        generateId: deps.utils?.generateId,
        generateHashId: deps.utils?.generateHashId,
        escapeHtml: deps.utils?.escapeHtml,
        safeAddEventListener: GlobalUtils?.safeAddEventListener,
        safeAddEventListenerById: GlobalUtils?.safeAddEventListenerById,
        isTouchDevice: (...args) => deps.utils?.isTouchDevice?.(...args),

        // Debug mode (from versioned debugMode via deps.utils)
        enableDebug: (...args) => deps.utils?.enableDebug?.(...args),
        disableDebug: (...args) => deps.utils?.disableDebug?.(...args),
        isDebug: () => deps.utils?.isDebug?.(),

        // Constants
        DEFAULT_TASK_OPTION_BUTTONS: deps.utils?.DEFAULT_TASK_OPTION_BUTTONS,

        // DOM helpers
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        getBody: () => document.body,
        getRootElement: () => document.documentElement,
        getActiveElement: () => document.activeElement,
        getTaskList: () => document.getElementById(DOM_IDS.TASK_LIST),
        getProgressBar: () => document.getElementById(DOM_IDS.PROGRESS_BAR),

        // Loading overlay (registered by uiBoot in Phase 3, use lazy getters)
        showLoader: (...args) => deps.ui?.showLoader?.(...args),
        hideLoader: (...args) => deps.ui?.hideLoader?.(...args),

        // Modal registry
        getModal: (...args) => deps.ui?.getModal?.(...args),
        invalidateModal: (...args) => deps.ui?.invalidateModal?.(...args),
        clearModalCache: (...args) => deps.ui?.clearModalCache?.(...args),

        // Safe storage
        safeLocalStorageGet: GlobalUtils?.safeLocalStorageGet,
        safeLocalStorageSet: GlobalUtils?.safeLocalStorageSet,
        safeJSONParse: GlobalUtils?.safeJSONParse,
        safeJSONStringify: GlobalUtils?.safeJSONStringify,

        // Console capture (from deps.utils) - use getter for lazy resolution
        get consoleCapture() { return deps.utils?.consoleCapture; },

        // Backup manager (from deps.storage) - use getter for lazy resolution
        get backupManager() { return deps.storage?.backupManager; },

        // From appContext (registered by coreBoot/featureBoot) - wrapper functions for lazy resolution
        completeInitialSetup: (...args) => getCompleteInitialSetup()?.(...args),

        // UI functions (from appContext or deps.ui) - validated lazy wrappers
        hideMainMenu: createValidatedWrapper('hideMainMenu',
            () => getHideMainMenu() || deps.ui?.hideMainMenu),
        // Provided by menuManager — focusMode menu calls these for "uncheck all" / "delete all"
        clearAllTasks: (...args) => deps.ui?.clearAllTasks?.(...args),
        deleteAllTasks: (...args) => deps.ui?.deleteAllTasks?.(...args),
        updateProgressBar: createValidatedWrapper('updateProgressBar',
            () => deps.progress?.updateProgressBar),
        checkCompleteAllButton: createValidatedWrapper('checkCompleteAllButton',
            () => deps.ui?.checkCompleteAllButton),
        applyCustomColors: createValidatedWrapper('applyCustomColors',
            () => deps.ui?.applyCustomColors),

        // Theme manager instance (from deps.features) - returns instance when called as function
        themeManager: () => deps.features?.themeManager,

        // Theme functions (from themeManager in deps.features)
        setupDarkModeToggle: (...args) => deps.features?.setupDarkModeToggle?.(...args),
        setupQuickDarkToggle: (...args) => deps.features?.setupQuickDarkToggle?.(...args),
        updateThemeColor: (...args) => deps.features?.updateThemeColor?.(...args),
        initThemesPanel: (...args) => deps.features?.initThemesPanel?.(...args),
        refreshThemeToggles: (...args) => deps.features?.refreshThemeToggles?.(...args),
        setupThemesPanel: (...args) => deps.features?.setupThemesPanel?.(...args),
        renderVocabThemes: (...args) => deps.features?.renderVocabThemes?.(...args),
        refreshThemeLabels: (...args) => deps.features?.themeManager?.refreshThemeLabels?.(...args),

        // Games functions (from gamesManager instance in deps.ui).
        // gamesManager is DEFERRED — unlockMiniGame (fired by a cycle milestone)
        // auto-loads it so the unlock persists. checkGamesUnlock stays a plain
        // lazy no-op: menuManager calls it once at boot setup, and forcing a load
        // there would defeat deferral. Menu-open loads gamesManager via the stub
        // in uiBoot.setupDeferredFeatureTriggers, whose init runs checkGamesUnlock.
        unlockMiniGame: (...args) => deferredInvoke('gamesManager', () => {
            const g = deps.ui?.gamesManager;
            return g?.unlockMiniGame ? g.unlockMiniGame.bind(g) : undefined;
        }, args),
        checkGamesUnlock: (...args) => deps.ui?.gamesManager?.checkGamesUnlock?.(...args),

        // Task functions (from task modules in deps.task) - lazy resolution for cross-phase deps
        validateAndSanitizeTaskInput: (...args) => deps.task?.validateAndSanitizeTaskInput?.(...args),
        loadTaskContext: (...args) => deps.task?.loadTaskContext?.(...args),
        createOrUpdateTaskData: (...args) => deps.task?.createOrUpdateTaskData?.(...args),
        createTaskDOMElements: (...args) => deps.task?.createTaskDOMElements?.(...args),
        setupTaskInteractions: (...args) => deps.task?.setupTaskInteractions?.(...args),
        finalizeTaskCreation: (...args) => deps.task?.finalizeTaskCreation?.(...args),
        refreshTaskListUI: (...args) => deps.task?.refreshTaskListUI?.(...args),
        renderTasks: (...args) => deps.task?.renderTasks?.(...args),
        addTask: (...args) => deps.task?.addTask?.(...args),
        resetTasks: (...args) => deps.task?.resetTasks?.(...args),
        handleTaskCompletionChange: (...args) => deps.task?.handleTaskCompletionChange?.(...args),
        saveTaskToSchema25: (...args) => deps.task?.saveTaskToSchema25?.(...args),
        taskToAddTaskOptions: (...args) => deps.task?.taskToAddTaskOptions?.(...args),

        // Task button container and click handler (from taskDOM)
        createTaskButtonContainer: (...args) => deps.task?.createTaskButtonContainer?.(...args),
        handleTaskButtonClick: (...args) => deps.task?.handleTaskButtonClick?.(...args),
        setupRecurringButtonHandler: (...args) => deps.task?.setupRecurringButtonHandler?.(...args),
        revealTaskButtons: (...args) => deps.task?.revealTaskButtons?.(...args),

        // TaskCore instance (for editTask, deleteTask, toggleTaskPriority) - lazy proxy
        taskCore: new Proxy({}, {
            get(target, prop) {
                return deps.task?.taskCore?.[prop];
            }
        }),

        // Task list rendering (loads from AppState then renders)
        renderTaskList: () => deps.task?.refreshTaskListUI?.(),

        // Mode sync (from GlobalUtils)
        syncAllTasksWithMode: (...args) => GlobalUtils?.syncAllTasksWithMode?.(...args),

        // Drag & drop functions (from deps.task)
        enableDragAndDropOnTask: (...args) => deps.task?.enableDragAndDropOnTask?.(...args),
        updateMoveArrowsVisibility: (...args) => deps.task?.updateMoveArrowsVisibility?.(...args),
        updateArrowsInDOM: (...args) => deps.task?.updateArrowsInDOM?.(...args),

        // Cycle functions (from cycle modules in deps.cycle) - lazy resolution
        switchMiniCycle: (...args) => deps.cycle?.switchMiniCycle?.(...args),
        renameMiniCycle: (...args) => deps.cycle?.renameMiniCycle?.(...args),
        deleteMiniCycle: (...args) => deps.cycle?.deleteMiniCycle?.(...args),
        loadMiniCycle: (...args) => deps.cycle?.loadMiniCycle?.(...args),
        showCycleCreationModal: (...args) => deps.cycle?.showCycleCreationModal?.(...args),
        createNewMiniCycle: (...args) => deps.cycle?.createNewMiniCycle?.(...args),
        preloadGettingStartedCycle: (...args) => deps.cycle?.preloadGettingStartedCycle?.(...args),
        preloadInitialRunCycle: (...args) => deps.cycle?.preloadInitialRunCycle?.(...args),
        checkMiniCycle: (...args) => deps.progress?.checkMiniCycle?.(...args),
        incrementCycleCount: (...args) => deps.progress?.incrementCycleCount?.(...args),
        showCompletionAnimation: (...args) => deps.progress?.showCompletionAnimation?.(...args),
        showClearAnimation: (...args) => deps.progress?.showClearAnimation?.(...args),
        animateProgressBarFill: (...args) => deps.progress?.animateProgressBarFill?.(...args),
        animateProgressBarEmpty: (...args) => deps.progress?.animateProgressBarEmpty?.(...args),
        showMilestoneCelebrationOverlay: (...args) => deps.progress?.showMilestoneCelebrationOverlay?.(...args),

        // UI functions (from deps.ui) - validated lazy wrappers for critical functions
        refreshUIFromState: createValidatedWrapper('refreshUIFromState',
            () => deps.task?.refreshUIFromState),
        closeAllModals: createValidatedWrapper('closeAllModals',
            () => deps.ui?.modalManager?.closeAllModals),
        isModalOpen: () => deps.ui?.modalManager?.isModalOpen?.(),
        // Overlay-active check (provided by uiBoot.js) — covers any open <dialog>,
        // visible main menu, notifications, onboarding modal, etc. Used by
        // gesturePanelManager + recurringIntegration to suppress swipes/gestures
        // while a modal/overlay is up. Falls back to false if uiBoot hasn't run.
        isOverlayActive: () => deps.ui?.isOverlayActive?.() ?? false,
        updateMainMenuHeader: createValidatedWrapper('updateMainMenuHeader',
            () => deps.ui?.updateMainMenuHeader),
        organizeCompletedTasks: (...args) => deps.ui?.completedTasksManager?.organize?.(...args),
        initCompletedTasksSection: (...args) => deps.ui?.completedTasksManager?.init?.(...args),
        handleTaskListMovement: (...args) => deps.ui?.completedTasksManager?.handleMovement?.(...args),
        updateCompletedTasksCount: (...args) => deps.ui?.completedTasksManager?.updateCount?.(...args),
        // Returns the completedTasksManager INSTANCE when called (matches statsPanelManager pattern)
        completedTasksManager: () => deps.ui?.completedTasksManager,
        updateStatsPanel: (...args) => deps.ui?.updateStatsPanel?.(...args),
        exportMiniCycleData: (...args) => deps.ui?.exportMiniCycleData?.(...args),
        startGuidedTour: (...args) => deps.ui?.startGuidedTour?.(...args),
        markTourWelcomeShown: (...args) => deps.ui?.markTourWelcomeShown?.(...args),
        // Provided by taskUI module (api: 'ui' — registered under deps.ui, not deps.task)
        hideTaskButtons: (...args) => deps.ui?.hideTaskButtons?.(...args),
        // Provided by taskSearch module — toggles search row visibility
        updateSearchVisibility: (...args) => deps.ui?.updateSearchVisibility?.(...args),
        // Provided by basicPluginSystem module — instance accessor
        pluginManager: () => deps.plugins?.pluginManager,
        // Provided by dataValidator module — utils API category
        DataValidator: () => deps.utils?.DataValidator,
        // Registered by coreBoot at deps.core (migration module export) — utils/cycle kept as legacy fallbacks
        createInitialSchema25Data: (...args) => (deps.core?.createInitialSchema25Data || deps.utils?.createInitialSchema25Data || deps.cycle?.createInitialSchema25Data)?.(...args),

        // ─── Boot/init helpers ───
        // Method on appInit instance — modules use it as a top-level dep instead of accessing appInit.waitForCore()
        waitForCore: (...args) => deps.core?.appInit?.waitForCore?.(...args),

        // ─── Recurring system functions (provided by recurringCore / recurringPanel) ───
        applyRecurringToTaskSchema25: (...args) => deps.recurring?.core?.applyRecurringToTaskSchema25?.(...args),
        openRecurringSettingsPanelForTask: (...args) => deps.recurring?.panel?.openRecurringSettingsPanelForTask?.(...args),
        calculateNextOccurrence: (...args) => deps.recurring?.core?.calculateNextOccurrence?.(...args),

        // ─── Task DOM helpers ───
        syncRecurringStateToDOM: (...args) => deps.task?.syncRecurringStateToDOM?.(...args),
        toggleHoverTaskOptions: (...args) => deps.task?.toggleHoverTaskOptions?.(...args),

        // ─── Feature modules ───
        setupDueDateButtonInteraction: (...args) => deps.features?.dueDates?.setupDueDateButtonInteraction?.(...args),

        // ─── Storage / backup ───
        // Returns the backupManager INSTANCE (matches statsPanelManager / completedTasksManager pattern)
        BackupManager: () => deps.storage?.backupManager,

        // ─── Settings ───
        resetDefaultRecurringSettings: (...args) => deps.ui?.settingsManager?.resetDefaultRecurringSettings?.(...args),

        // ─── Global state checks ───
        // Returns the boolean flag (call-as-function for consistency with other depMappings)
        isPerformingUndoRedo: () => deps.core?.AppGlobalState?.isPerformingUndoRedo ?? false,
        // Notification drag state — used by gesture / swipe handlers to skip while dragging a toast
        isDraggingNotification: () => deps.utils?.notifications?.isDraggingNotification ?? false,

        // ─── Testing ───
        appendToTestResults: (...args) => deps.testing?.appendToTestResults?.(...args),

        // ─── Constants / migrations injected via deps.core (set by coreBoot) ───
        // Direct value access (not a function wrapper) — depMappings is built per-module
        // inside buildModuleDependencies, so deps.core is already populated by this point.
        DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: deps.core?.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
        performSchema25Migration: deps.core?.performSchema25Migration,
        showStatsTourNotification: (...args) => deps.ui?.showStatsTourNotification?.(...args),
        showPersonalizationTourNotification: (...args) => deps.ui?.showPersonalizationTourNotification?.(...args),
        showTaskOptionsTourNotification: (...args) => deps.ui?.showTaskOptionsTourNotification?.(...args),
        showRemindersTourNotification: (...args) => deps.ui?.showRemindersTourNotification?.(...args),
        showMenuTourNotification: (...args) => deps.ui?.showMenuTourNotification?.(...args),
        showSettingsTourNotification: (...args) => deps.ui?.showSettingsTourNotification?.(...args),
        showRoutineSwitcherTourNotification: (...args) => deps.ui?.showRoutineSwitcherTourNotification?.(...args),
        showRecurringListTourNotification: (...args) => deps.ui?.showRecurringListTourNotification?.(...args),
        showRecurringSettingsTourNotification: (...args) => deps.ui?.showRecurringSettingsTourNotification?.(...args),
        showHistoryTourNotification: (...args) => deps.ui?.showHistoryTourNotification?.(...args),
        showClearedTasksTourNotification: (...args) => deps.ui?.showClearedTasksTourNotification?.(...args),
        showAchievementsTourNotification: (...args) => deps.ui?.showAchievementsTourNotification?.(...args),
        hasActiveNotifications: (...args) => deps.ui?.hasActiveNotifications?.(...args),
        triggerLogoBackground: (...args) => deps.ui?.triggerLogoBackground?.(...args),
        triggerLogoScan: (...args) => deps.ui?.triggerLogoScan?.(...args),
        showTaskOptions: (...args) => deps.ui?.showTaskOptions?.(...args),
        hideTaskOptions: (...args) => deps.ui?.hideTaskOptions?.(...args),
        get TaskOptionsVisibilityController() { return deps.ui?.TaskOptionsVisibilityController; },
        attachKeyboardTaskOptionToggle: (...args) => deps.ui?.attachKeyboardTaskOptionToggle?.(...args),
        // taskOptionsCustomizer is an object - use Proxy for lazy resolution since it loads after taskDOM
        taskOptionsCustomizer: new Proxy({}, {
            get(target, prop) {
                return deps.ui?.taskOptionsCustomizer?.[prop];
            }
        }),

        // Undo/redo functions (api: 'undo' maps to deps.ui via apiToCategory) - validated
        captureStateSnapshot: createValidatedWrapper('captureStateSnapshot',
            () => deps.ui?.captureStateSnapshot),
        performStateBasedUndo: createValidatedWrapper('performStateBasedUndo',
            () => deps.ui?.performStateBasedUndo),
        performStateBasedRedo: createValidatedWrapper('performStateBasedRedo',
            () => deps.ui?.performStateBasedRedo),
        enableUndoSystemOnFirstInteraction: createValidatedWrapper('enableUndoSystemOnFirstInteraction',
            () => deps.ui?.enableUndoSystemOnFirstInteraction),
        updateUndoRedoButtons: createValidatedWrapper('updateUndoRedoButtons',
            () => deps.ui?.updateUndoRedoButtons),
        clearAllUndoHistory: (...args) => deps.ui?.clearAllUndoHistory?.(...args),
        // Undo cycle lifecycle hooks (called by routineSwitcher when cycles change)
        onCycleSwitched: (...args) => deps.ui?.onCycleSwitched?.(...args),
        onCycleCreated: (...args) => deps.ui?.onCycleCreated?.(...args),
        onCycleDeleted: (...args) => deps.ui?.onCycleDeleted?.(...args),
        onCycleRenamed: (...args) => deps.ui?.onCycleRenamed?.(...args),

        // Reminders (from deps.features)
        startReminders: (...args) => deps.features?.startReminders?.(...args),
        stopReminders: (...args) => deps.features?.stopReminders?.(...args),
        updateReminderButtons: (...args) => deps.features?.updateReminderButtons?.(...args),
        setupReminderButtonHandler: (...args) => deps.features?.setupReminderButtonHandler?.(...args),
        loadRemindersSettings: (...args) => deps.features?.loadRemindersSettings?.(...args),

        // Due dates (from deps.features)
        checkOverdueTasks: (...args) => deps.features?.checkOverdueTasks?.(...args),
        remindOverdueTasks: (...args) => deps.features?.remindOverdueTasks?.(...args),
        createDueDateInput: (...args) => deps.features?.createDueDateInput?.(...args),

        // History manager (from deps.features) - use Proxy for lazy resolution
        historyManager: new Proxy({}, {
            get(target, prop) {
                const manager = deps.features?.historyManager;
                const value = manager?.[prop];
                // Bind methods to preserve 'this' context
                return typeof value === 'function' ? value.bind(manager) : value;
            }
        }),
        logHistoryEvent: (...args) => deps.features?.historyManager?.logEvent?.(...args),
        getHistory: (...args) => deps.features?.historyManager?.getHistory?.(...args),
        clearHistory: (...args) => deps.features?.historyManager?.clearHistory?.(...args),
        openHistoryModal: (...args) => deps.features?.historyManager?.openModal?.(...args),
        refreshHistoryIfOpen: (...args) => deps.features?.historyManager?.refreshIfOpen?.(...args),

        // Cleared tasks manager (from deps.features) - use Proxy for lazy resolution
        clearedTasksManager: new Proxy({}, {
            get(target, prop) {
                const manager = deps.features?.clearedTasksManager;
                const value = manager?.[prop];
                // Bind methods to preserve 'this' context
                return typeof value === 'function' ? value.bind(manager) : value;
            }
        }),
        recordClearedTask: (...args) => deps.features?.clearedTasksManager?.recordClearedTask?.(...args),
        recordMultipleClearedTasks: (...args) => deps.features?.clearedTasksManager?.recordMultipleClearedTasks?.(...args),
        getClearedTasks: (...args) => deps.features?.clearedTasksManager?.getClearedTasks?.(...args),
        clearClearedTasks: (...args) => deps.features?.clearedTasksManager?.clearAll?.(...args),
        openClearedTasksModal: (...args) => deps.features?.clearedTasksManager?.openModal?.(...args),

        // Achievements manager (from deps.features) - use Proxy for lazy resolution
        achievementsManager: new Proxy({}, {
            get(target, prop) {
                const manager = deps.features?.achievementsManager;
                const value = manager?.[prop];
                // Bind methods to preserve 'this' context
                return typeof value === 'function' ? value.bind(manager) : value;
            }
        }),
        checkAchievements: (...args) => deps.features?.achievementsManager?.checkAchievements?.(...args),
        getAchievements: (...args) => deps.features?.achievementsManager?.getAchievements?.(...args),
        isAchievementUnlocked: (...args) => deps.features?.achievementsManager?.isUnlocked?.(...args),
        openAchievementsModal: (...args) => deps.features?.achievementsManager?.openModal?.(...args),

        // Backup reminder (from deps.features)
        checkBackupReminderOnBoot: (...args) => deps.features?.checkBackupReminderOnBoot?.(...args),
        checkBackupReminderOnCycleComplete: (...args) => deps.features?.checkBackupReminderOnCycleComplete?.(...args),
        checkBackupReminderOnTaskClear: (...args) => deps.features?.checkBackupReminderOnTaskClear?.(...args),

        // Backup file download (from deps.ui via settingsManager)
        downloadBackupFile: (...args) => deps.ui?.downloadBackupFile?.(...args),

        // Vocabulary theme manager (from deps.features) - use Proxy for lazy resolution
        vocabThemeManager: new Proxy({}, {
            get(target, prop) {
                const manager = deps.features?.vocabThemeManager;
                const value = manager?.[prop];
                return typeof value === 'function' ? value.bind(manager) : value;
            }
        }),

        // Recurring task activation/deactivation (from recurringCore via deps.recurring.core)
        handleRecurringTaskActivation: (...args) => deps.recurring?.core?.handleRecurringTaskActivation?.(...args),
        handleRecurringTaskDeactivation: (...args) => deps.recurring?.core?.handleRecurringTaskDeactivation?.(...args),

        // Recurring (from deps.recurring) - use Proxy for lazy evaluation
        // Proxy allows property access (e.g., recurringPanel.updateRecurringPanelButtonVisibility)
        // to be resolved lazily after the module loads
        // Note: manifest provides ['panel', 'core'], so keys are deps.recurring.panel / deps.recurring.core
        recurringPanel: new Proxy({}, {
            get(target, prop) {
                return deps.recurring?.panel?.[prop];
            }
        }),
        recurringCore: new Proxy({}, {
            get(target, prop) {
                return deps.recurring?.core?.[prop];
            }
        }),
        updateRecurringPanel: (...args) => deps.recurring?.panel?.updateRecurringPanel?.(...args),
        updateRecurringPanelButtonVisibility: (...args) => deps.recurring?.panel?.updateRecurringPanelButtonVisibility?.(...args),
        updateRecurringInfoLink: (...args) => deps.recurring?.panel?.updateRecurringInfoLink?.(...args),
        catchUpMissedRecurringTasks: (...args) => deps.recurring?.core?.catchUpMissedRecurringTasks?.(...args),
        watchRecurringTasks: (...args) => deps.recurring?.core?.watchRecurringTasks?.(...args),
        removeRecurringTasksFromCycle: (...args) => {
            // Try multiple paths for compatibility
            const fn = deps.recurring?.core?.removeRecurringTasksFromCycle
                    || deps.recurring?.removeTasksFromCycle;
            return fn?.(...args);
        },

        // Mode manager (from deps.cycle)
        modeManager: new Proxy({}, {
            get(target, prop) {
                return deps.cycle?.modeManager?.[prop];
            }
        }),
        refreshTaskButtonsForModeChange: (...args) => deps.cycle?.refreshTaskButtonsForModeChange?.(...args),
        initializeModeSelector: (...args) => deps.cycle?.setupModeSelector?.(...args),
        setupModeSelector: (...args) => deps.cycle?.setupModeSelector?.(...args),
        updateCycleModeDescription: (...args) => deps.cycle?.updateCycleModeDescription?.(...args),
        syncModeFromToggles: (...args) => deps.cycle?.modeManager?.syncModeFromToggles?.(...args),

        // Help window manager (from deps.ui) - returns instance when called as function
        helpWindowManager: () => deps.ui?.helpWindowManager,
        updateHelpWindow: (...args) => deps.ui?.helpWindowManager?.refreshLabels?.(...args),
        showCustomizerTip: (...args) => deps.ui?.helpWindowManager?.showCustomizerTip?.(...args),

        // Focus-mode action button refresh — called by themeManager when
        // vocab theme changes so the button's data-label / aria pick up
        // new theme values without waiting for the next mode toggle.
        refreshFocusActionButton: (...args) => deps.ui?.focusMode?.refreshActionButton?.(...args),
        activateFocusMode: (...args) => deps.ui?.focusMode?.activate?.(...args),

        // Task View Layout reset — called from settings "Reset Task View
        // Layout" button to clear all customized positions.
        resetTaskViewLayout: (...args) => deps.ui?.taskViewLayoutManager?.resetTaskViewLayout?.(...args),

        // Task View Layout refresh — called by undoRedoManager after a
        // snapshot restore so dragged elements visually follow the state
        // change. Reconciles inline drag styles to the just-restored
        // state.settings.taskViewLayout.positions map.
        refreshTaskViewLayout: (...args) => deps.ui?.taskViewLayoutManager?.refreshTaskViewLayout?.(...args),

        // Stats panel manager (from deps.ui) - returns instance when called as function
        statsPanelManager: () => deps.ui?.statsPanelManager,

        // Quick actions tracking (from quickActionsManager in deps.ui)
        trackAction: (...args) => deps.ui?.trackAction?.(...args),

        // Stats panel navigation (direct access for quickActionsManager and others)
        showStatsPanel: (...args) => deps.ui?.showStatsPanel?.(...args),
        showTaskView: (...args) => deps.ui?.statsPanelManager?.showTaskView?.(...args),

        // Gesture panel callbacks (for gesturePanelManager to call when gestures detected)
        onShowStatsPanel: () => deps.ui?.statsPanelManager?.showStatsPanel?.(),
        onShowTaskView: () => deps.ui?.statsPanelManager?.showTaskView?.(),

        // Gesture panel manager (from deps.ui) - returns instance when called as function
        gesturePanelManager: () => deps.ui?.gesturePanelManager,

        // Onboarding manager (from deps.ui) - returns instance when called as function
        getOnboardingManager: () => deps.ui?.onboardingManager,

        // UIOrchestrator (from deps.ui) - lazy resolution for UI update coalescing
        // Note: Use getUIOrchestrator() to get the instance, not the class
        // Methods must be bound to preserve 'this' context
        UIOrchestrator: new Proxy({}, {
            get(target, prop) {
                const instance = deps.ui?.getUIOrchestrator?.();
                const value = instance?.[prop];
                // Bind methods to preserve 'this' context
                if (typeof value === 'function') {
                    return value.bind(instance);
                }
                return value;
            }
        }),
        requestUIUpdate: (...args) => deps.ui?.requestUIUpdate?.(...args),
        flushUIUpdates: (...args) => deps.ui?.flushUIUpdates?.(...args),
        getUIOrchestrator: () => deps.ui?.getUIOrchestrator?.(),
        ui: new Proxy({}, {
            get(target, prop) {
                return deps.ui?.ui?.[prop];
            }
        }),

        // Additional dependencies for UIOrchestrator
        // Methods must be bound to preserve 'this' context
        TaskDOMManager: new Proxy({}, {
            get(target, prop) {
                const instance = deps.task?.taskDOMManager;
                const value = instance?.[prop];
                if (typeof value === 'function') {
                    return value.bind(instance);
                }
                return value;
            }
        }),
        TaskRenderer: new Proxy({}, {
            get(target, prop) {
                // renderTasks is exported as a standalone function, not on an instance
                if (prop === 'renderTasks') {
                    return deps.task?.renderTasks;
                }
                return undefined;
            }
        }),
        setArrowsEnabled: (...args) => deps.task?.setArrowsEnabled?.(...args),
        updateFirstLastMarkers: (...args) => deps.task?.updateFirstLastMarkers?.(...args),

    };

    // Store keys for test verification (populated once on first module)
    if (!_depMappingKeys) {
        _depMappingKeys = new Set(Object.keys(depMappings));
    }

    // Inject declared deps: requires + lazyRequires + optionalDeps, all resolved
    // the same way (depMappings, falling back to coreResult). optionalDeps MUST be
    // injected here too — under ENFORCE_REQUIRES the broad Object.assign below is
    // skipped, so this loop is their only source; without it every optionalDeps
    // dep would silently become undefined when the flag flips.
    injectDeclaredDeps(result, manifest, depMappings, coreResult);

    // Inject framework-level CORE_DEPS (DOM helpers, sanitizeInput, safe* utils,
    // …) that live in depMappings, so they survive ENFORCE_REQUIRES mode where the
    // broad Object.assign below is skipped. The Phase-1 CORE_DEPS (AppState, …) are
    // not depMappings keys, so the AppState Proxy set above is left untouched.
    injectCoreDeps(result, CORE_DEPS, depMappings);

    // Validate required dependencies (warning-only)
    // This helps catch manifest errors where a module requires an API that doesn't exist
    // Skip validation for optional modules - they're expected to have potentially missing deps
    if (!manifest.optional) {
        for (const req of [...(manifest.requires || []), ...(manifest.lazyRequires || [])]) {
            const value = result[req];
            if (value === undefined) {
                // Skip core deps that are provided differently (e.g., AppState via Proxy)
                if (!CORE_DEPS.has(req)) {
                    console.warn(`⚠️ ${manifest.path}: Required dep '${req}' is undefined (not provided by any module)`);
                }
            }
        }
    }

    // Audit: warn for any declared dep (incl. optionalDeps) that has no
    // depMappings entry and isn't a core dep. This catches the silent-failure
    // bug class where consumers fall back to their `optional()` default forever.
    // Runs for optional modules too — dep declarations are static regardless of
    // module optionality, and skipping them hid real gaps (July 2026 boot audit).
    // See WARN_ON_UNMAPPED_DECLARED_DEPS at top of file for context.
    if (WARN_ON_UNMAPPED_DECLARED_DEPS) {
        const allDeclared = [
            ...(manifest.requires || []),
            ...(manifest.optionalDeps || []),
            ...(manifest.lazyRequires || [])
        ];
        for (const dep of allDeclared) {
            if (!(dep in depMappings) && !CORE_DEPS.has(dep)) {
                const gapKey = `${manifest.path}::${dep}`;
                if (!_warnedDIGaps.has(gapKey)) {
                    _warnedDIGaps.add(gapKey);
                    console.warn(
                        `⚠️ DI gap: ${manifest.path} declares "${dep}" but no depMappings entry exists. ` +
                        `Consumer will fall back to its optional() default — function calls will silently no-op.`
                    );
                }
            }
        }
    }

    // ENFORCE_REQUIRES mode: Only provide declared dependencies
    // When false (default): Provide ALL deps for backwards compatibility
    if (!ENFORCE_REQUIRES) {
        Object.assign(result, depMappings);
    }

    // AUDIT mode: Wrap in Proxy to detect undeclared dep access
    if (AUDIT_UNDECLARED_DEPS && !ENFORCE_REQUIRES) {
        // Static declared deps (from manifest)
        const manifestDeclaredDeps = new Set([
            ...(manifest.requires || []),
            ...(manifest.lazyRequires || []),
            ...(manifest.optionalDeps || []),
            // Standard object properties
            'then', 'catch', 'finally', 'constructor', 'prototype',
            'toString', 'valueOf', 'toJSON',
        ]);

        // Track warned props to avoid spamming (e.g., when devtools enumerates properties)
        const warnedProps = new Set();

        return new Proxy(result, {
            get(target, prop) {
                // Only log for string properties that look like dep names
                if (typeof prop === 'string' &&
                    !manifestDeclaredDeps.has(prop) &&
                    !CORE_DEPS.has(prop) &&  // Check CORE_DEPS dynamically (may be populated after Proxy creation)
                    prop in depMappings &&
                    !prop.startsWith('_') &&
                    !warnedProps.has(prop)) {  // Only warn once per prop
                    warnedProps.add(prop);
                    console.warn(`📋 AUDIT: ${manifest.path} accessed undeclared dep '${prop}' - add to requires`);
                }
                return target[prop];
            }
        });
    }

    return result;
}

/**
 * Register a module's provided APIs in the deps container
 * @param {string} name - Module name
 * @param {Object} manifest - Module manifest
 * @param {Object} instance - Module instance (from init function)
 * @param {Object} deps - Dependencies container
 * @param {Object} mod - Raw module exports (optional fallback for wrapper functions)
 */
function registerProvides(name, manifest, instance, deps, mod = null) {
    if (!manifest.provides) return;

    // Determine which deps category to use
    const category = getDepsCategoryForModule(manifest);

    for (const provided of manifest.provides) {
        // Look for the provided function/property on instance first
        let value = findProvidedValue(instance, provided);

        // Fallback to raw module exports if not found on instance
        // This handles cases where init returns an instance but wrapper functions are module-level exports
        if (value === undefined && mod) {
            value = findProvidedValue(mod, provided);
        }

        if (value !== undefined) {
            // Add to appropriate deps category
            if (deps[category]) {
                deps[category][provided] = value;
            }
        }
    }
}

/**
 * Get the deps category for a module
 * @param {Object} manifest - Module manifest
 * @returns {string}
 */
function getDepsCategoryForModule(manifest) {
    const apiToCategory = {
        state: 'core',
        task: 'task',
        cycle: 'cycle',
        ui: 'ui',
        undo: 'ui',
        features: 'features',
        recurring: 'recurring',
        utils: 'utils',
        labels: 'labels',
        testing: 'testing',
        storage: 'storage',
        plugins: 'plugins',
        progress: 'progress'
    };

    return apiToCategory[manifest.api] || 'features';
}

/**
 * Find a provided value from a module instance
 * @param {Object} instance - Module instance
 * @param {string} name - Name to find
 * @returns {*}
 */
function findProvidedValue(instance, name) {
    const value = instance[name];

    if (typeof value === 'function') {
        // Check if this is a class (ES6 class or constructor function with static methods)
        // Classes should NOT be bound because .bind() strips away static methods
        const isClass = /^class\s/.test(value.toString()) ||
                        (value.prototype && value.prototype.constructor === value &&
                         Object.getOwnPropertyNames(value).some(prop =>
                             prop !== 'length' && prop !== 'name' && prop !== 'prototype' &&
                             typeof value[prop] === 'function'));

        if (isClass) {
            // Return class as-is to preserve static methods
            return value;
        }

        // Regular function - bind to preserve 'this' context
        return value.bind(instance);
    }

    // Direct property (non-function)
    if (value !== undefined) {
        return value;
    }

    // Getter
    const descriptor = Object.getOwnPropertyDescriptor(instance, name);
    if (descriptor?.get) {
        return descriptor.get.call(instance);
    }

    return undefined;
}

/**
 * Build grouped APIs from loaded modules
 * @param {Object} deps - Dependencies container
 * @returns {Object}
 */
function buildGroupedApis(deps) {
    return {
        state: {
            AppState: deps.core?.AppState,
            AppGlobalState: deps.core?.AppGlobalState,
            AppMeta: deps.core?.AppMeta,
            loadMiniCycleData: deps.core?.loadMiniCycleData,
            autoSave: deps.core?.autoSave
        },
        task: {
            add: deps.task?.addTask,
            delete: deps.task?.deleteTask,
            handleCompleteAll: deps.task?.handleCompleteAllTasks,
            loadContext: deps.task?.loadTaskContext,
            createDOM: deps.task?.createTaskDOMElements,
            extractFromDOM: deps.task?.extractTaskDataFromDOM,
            updateMoveArrows: deps.task?.updateMoveArrowsVisibility,
            refresh: deps.task?.refreshTaskListUI
        },
        cycle: {
            load: deps.cycle?.loadMiniCycle,
            create: deps.cycle?.showCycleCreationModal,
            switch: deps.cycle?.switchMiniCycle,
            rename: deps.cycle?.renameMiniCycle,
            delete: deps.cycle?.deleteMiniCycle,
            check: deps.progress?.checkMiniCycle,
            initializeModeSelector: deps.cycle?.setupModeSelector,
            setupModeSelector: deps.cycle?.setupModeSelector,
            modeManager: deps.cycle?.modeManager
        },
        ui: {
            showNotification: deps.utils?.showNotification,
            showConfirmationModal: deps.utils?.showConfirmationModal,
            showPromptModal: deps.utils?.showPromptModal,
            hideMainMenu: deps.ui?.hideMainMenu,
            updateMainMenuHeader: deps.ui?.updateMainMenuHeader,
            closeAllModals: (...args) => deps.ui?.modalManager?.closeAllModals?.(...args),
            resetNotificationPosition: deps.utils?.resetNotificationPosition
        },
        undo: {
            capture: deps.ui?.captureStateSnapshot,
            undo: deps.ui?.performStateBasedUndo,
            redo: deps.ui?.performStateBasedRedo,
            updateButtons: deps.ui?.updateUndoRedoButtons,
            enableOnFirstInteraction: deps.ui?.enableUndoSystemOnFirstInteraction
        },
        reminder: {
            manager: deps.features?.reminderManager,
            start: deps.features?.startReminders,
            stop: deps.features?.stopReminders,
            updateButtons: deps.features?.updateReminderButtons,
            loadSettings: deps.features?.loadRemindersSettings
        },
        recurring: {
            panel: deps.recurring?.panel,
            core: deps.recurring?.core,
            openForTask: deps.recurring?.openForTask
        },
        utils: {
            GlobalUtils: deps.utils?.GlobalUtils,
            DataValidator: deps.utils?.DataValidator,
            sanitizeInput: deps.utils?.sanitizeInput,
            generateId: deps.utils?.generateId,
            generateHashId: deps.utils?.generateHashId,
            safeAddEventListener: deps.utils?.safeAddEventListener,
            isTouchDevice: deps.utils?.isTouchDevice
        }
    };
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get a loaded module by name
 * @param {string} name - Module name
 * @returns {Object|null}
 */
/**
 * Get the set of depMappings keys (for DI wiring tests)
 * @returns {Set<string>|null} Keys available in depMappings, or null if boot hasn't run
 */
export function getDepMappingKeys() {
    return _depMappingKeys;
}

/**
 * Populate and return the depMappings key set WITHOUT a full app boot.
 *
 * The DI wiring tests (diWiring.tests.js) need the real depMappings keys, but
 * `_depMappingKeys` is only captured the first time `buildModuleDependencies()`
 * runs during `loadAllModules()`. The CLI/Playwright harness never boots the app,
 * so the keys stay null and the wiring battery self-skips.
 *
 * depMappings values are closures over `deps` that are NOT invoked at build time
 * (they only deref `deps.x?.y?.()` when later called), so building it once with
 * empty stubs is side-effect-free and yields the exact same keys the real boot
 * would. This keeps the test honest: keys come from the real object literal, so
 * adding/removing a depMappings entry is reflected automatically.
 *
 * @returns {Set<string>} The depMappings key set (never null).
 */
export function ensureDepMappingKeys() {
    if (!_depMappingKeys) {
        buildModuleDependencies(
            { path: 'di-wiring-test', requires: [], optionalDeps: [], lazyRequires: [] },
            {},
            {}
        );
    }
    return _depMappingKeys || new Set();
}

export function getLoadedModule(name) {
    return loadedModules.get(name) || null;
}

/**
 * Get a module instance by name
 * @param {string} name - Module name
 * @returns {Object|null}
 */
export function getModuleInstance(name) {
    return moduleInstances.get(name) || null;
}

/**
 * Check if a module is loaded
 * @param {string} name - Module name
 * @returns {boolean}
 */
export function isModuleLoaded(name) {
    return loadedModules.has(name);
}

/**
 * Destroy all module instances that implement destroy().
 * Called before clearLoadedModules() on boot retry.
 */
export function destroyAllModules() {
    for (const [name, instance] of moduleInstances) {
        if (instance && typeof instance.destroy === 'function') {
            try {
                instance.destroy();
            } catch (e) {
                console.warn(`[moduleLoader] destroy() failed for ${name}:`, e);
            }
        }
    }
}

/**
 * Clear all loaded modules (for retry/testing).
 * Call destroyAllModules() first to clean up listeners and timers.
 */
export function clearLoadedModules() {
    loadedModules.clear();
    moduleInstances.clear();
}
