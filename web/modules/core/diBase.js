/**
 * @file diBase.js
 * @description Dependency Injection base utilities for miniCycle modules
 * @module modules/core/diBase
 *
 * This module provides standardized DI patterns to eliminate boilerplate
 * across all 49+ modules. Instead of each module repeating 20+ lines of
 * dependency setup, they use these utilities.
 *
 * PATTERNS PROVIDED:
 * 1. createDIModule() - Factory for module-level DI with validation
 * 2. lazy() - Lazy getter wrapper for cross-module dependencies
 * 3. required() - Marker for required dependencies (throws if missing)
 * 4. optional() - Marker for optional dependencies with defaults
 *
 * USAGE:
 * ```javascript
 * import { createDIModule, lazy, required, optional } from '../core/diBase.js';
 *
 * const di = createDIModule('TaskCore', {
 *     // Required deps - will warn if missing
 *     AppState: required(),
 *     loadMiniCycleData: required(),
 *     showNotification: required(),
 *
 *     // Optional deps - uses provided default
 *     autoSave: optional(() => console.log('autoSave not available')),
 *     updateProgressBar: optional(() => {}),
 * });
 *
 * export const setTaskCoreDependencies = di.setDependencies;
 *
 * export class TaskCore {
 *     constructor(overrides = {}) {
 *         this.deps = di.resolve(overrides);
 *         // this.deps.AppState is now guaranteed or warning logged
 *     }
 * }
 * ```
 *
 * @version 1.0.0
 */

// Version marker for cache debugging (updated by update-version.sh)
export const DIBASE_VERSION = '1.559';

// ============================================================================
// DEPENDENCY MARKERS
// ============================================================================

const REQUIRED = Symbol('required');
const OPTIONAL = Symbol('optional');

/**
 * Mark a dependency as required
 * If missing at resolve time, logs a warning (dev) or throws (strict mode)
 * @returns {Object} Required marker
 */
export function required() {
    return { [REQUIRED]: true };
}

/**
 * Mark a dependency as optional with a default value
 * @param {*} defaultValue - Default value if dependency not provided
 * @returns {Object} Optional marker with default
 */
export function optional(defaultValue = null) {
    return { [OPTIONAL]: true, default: defaultValue };
}

/**
 * Create a lazy getter that resolves at access time
 * Use for cross-module dependencies that may not exist at wire time
 *
 * @param {Function} getter - Function that returns the dependency
 * @returns {Object} Object with getter property
 *
 * @example
 * this.deps = {
 *     // Resolves each time accessed - always gets latest value
 *     AppState: lazy(() => getApi('state').AppState),
 * };
 * // Access: this.deps.AppState.get()
 */
export function lazy(getter) {
    return {
        get value() {
            try {
                return getter();
            } catch (e) {
                console.warn('Lazy dependency resolution failed:', e);
                return null;
            }
        }
    };
}

// ============================================================================
// MODULE DI FACTORY
// ============================================================================

/**
 * Create a DI container for a module
 * Eliminates boilerplate by providing standardized:
 * - setDependencies() function
 * - resolve() function with validation
 * - Logging and error handling
 *
 * @param {string} moduleName - Name for logging (e.g., 'TaskCore')
 * @param {Object} schema - Dependency schema with required/optional markers
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.strict=false] - Throw on missing required deps
 * @param {boolean} [options.logResolution=false] - Log dependency resolution
 * @returns {Object} DI container with setDependencies and resolve methods
 *
 * @example
 * const di = createDIModule('MenuManager', {
 *     AppState: required(),
 *     showNotification: required(),
 *     autoSave: optional(() => {}),
 * });
 *
 * export const setMenuManagerDependencies = di.setDependencies;
 *
 * class MenuManager {
 *     constructor(overrides) {
 *         this.deps = di.resolve(overrides);
 *     }
 * }
 */
export function createDIModule(moduleName, schema = {}, options = {}) {
    const { strict = false, logResolution = false } = options;

    // Internal storage for injected dependencies
    let _injected = {};

    // Track what's been set for debugging
    let _setKeys = new Set();

    return {
        /**
         * Module name for logging
         */
        name: moduleName,

        /**
         * Set dependencies for this module
         * Preserves getters using Object.defineProperties
         *
         * @param {Object} dependencies - Dependencies to inject
         * @param {Object} [options] - Options for setting dependencies
         * @param {boolean} [options.replace=false] - If true, clears existing deps first
         */
        setDependencies(dependencies, { replace = false } = {}) {
            if (!dependencies || typeof dependencies !== 'object') {
                console.warn(`⚠️ ${moduleName}: setDependencies called with invalid value`);
                return;
            }

            // If replace mode, clear existing deps first
            if (replace) {
                _injected = {};
                _setKeys.clear();
            }

            // Use defineProperties to preserve getters (for lazy binding)
            const descriptors = Object.getOwnPropertyDescriptors(dependencies);
            Object.defineProperties(_injected, descriptors);

            // Track what was set
            Object.keys(dependencies).forEach(k => _setKeys.add(k));

            console.log(`✅ ${moduleName} deps set:`, Object.keys(dependencies));
        },

        /**
         * Reset all injected dependencies
         * Useful for testing or reinitializing a module
         */
        reset() {
            _injected = {};
            _setKeys.clear();
            console.log(`🔄 ${moduleName} deps reset`);
        },

        /**
         * Clear a specific dependency
         * @param {string} key - Dependency key to remove
         */
        clear(key) {
            delete _injected[key];
            _setKeys.delete(key);
        },

        /**
         * Resolve dependencies, merging injected with constructor overrides
         * Validates required deps and applies defaults for optional ones
         *
         * @param {Object} [overrides={}] - Constructor-provided overrides
         * @returns {Object} Resolved dependencies
         */
        resolve(overrides = {}) {
            const resolved = {};
            const missing = [];

            // Process schema
            for (const [key, marker] of Object.entries(schema)) {
                // Priority: override > injected > default
                const value = overrides[key] ?? _injected[key];

                if (marker[REQUIRED]) {
                    if (value === undefined || value === null) {
                        missing.push(key);
                        resolved[key] = null;
                    } else {
                        resolved[key] = value;
                    }
                } else if (marker[OPTIONAL]) {
                    resolved[key] = value ?? marker.default;
                } else {
                    // Plain value in schema (unusual but supported)
                    resolved[key] = value ?? marker;
                }
            }

            // Also include any extra deps not in schema
            // (for backwards compatibility during migration)
            for (const [key, value] of Object.entries(_injected)) {
                if (!(key in resolved)) {
                    resolved[key] = overrides[key] ?? value;
                }
            }
            for (const [key, value] of Object.entries(overrides)) {
                if (!(key in resolved)) {
                    resolved[key] = value;
                }
            }

            // Report missing required deps
            if (missing.length > 0) {
                const msg = `⚠️ ${moduleName} missing required deps: ${missing.join(', ')}`;
                console.warn(msg);

                if (strict) {
                    throw new Error(msg);
                }
            }

            if (logResolution) {
                console.log(`🔧 ${moduleName} resolved:`, Object.keys(resolved));
            }

            return resolved;
        },

        /**
         * Get current injected dependencies (for debugging)
         * @returns {Object} Copy of injected deps
         */
        getInjected() {
            return { ..._injected };
        },

        /**
         * Check if a specific dependency has been set
         * @param {string} key - Dependency key
         * @returns {boolean}
         */
        has(key) {
            return _setKeys.has(key) || key in _injected;
        },

        /**
         * Update a single dependency after initial setup
         * Useful for late-bound dependencies
         *
         * @param {string} key - Dependency key
         * @param {*} value - New value
         */
        update(key, value) {
            _injected[key] = value;
            _setKeys.add(key);
        },

        /**
         * Get list of required dependencies from schema
         * @returns {string[]}
         */
        getRequiredKeys() {
            return Object.entries(schema)
                .filter(([_, marker]) => marker[REQUIRED])
                .map(([key]) => key);
        },

        /**
         * Get list of optional dependencies from schema
         * @returns {string[]}
         */
        getOptionalKeys() {
            return Object.entries(schema)
                .filter(([_, marker]) => marker[OPTIONAL])
                .map(([key]) => key);
        }
    };
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Create a simple fallback function that logs when called
 * Use for optional dependencies that should no-op gracefully
 *
 * @param {string} name - Name of the dependency (for logging)
 * @returns {Function} No-op function that logs once
 */
export function createFallback(name) {
    let logged = false;
    return (...args) => {
        if (!logged) {
            console.log(`⏭️ ${name} not available (fallback)`);
            logged = true;
        }
        return undefined;
    };
}

/**
 * Create a fallback that returns a specific value
 * @param {string} name - Name for logging
 * @param {*} returnValue - Value to return
 * @returns {Function}
 */
export function createFallbackWithValue(name, returnValue) {
    let logged = false;
    return (...args) => {
        if (!logged) {
            console.log(`⏭️ ${name} not available, returning default`);
            logged = true;
        }
        return returnValue;
    };
}

/**
 * Wrap a dependency getter to handle null/undefined gracefully
 * @param {Function} getter - Function that returns dependency
 * @param {string} [name='dependency'] - Name for error messages
 * @returns {Function} Wrapped getter
 */
export function safeGet(getter, name = 'dependency') {
    return (...args) => {
        try {
            const dep = getter();
            if (dep && typeof dep === 'function') {
                return dep(...args);
            }
            return dep;
        } catch (e) {
            console.warn(`⚠️ Failed to resolve ${name}:`, e.message);
            return undefined;
        }
    };
}

// ============================================================================
// TYPE DEFINITIONS (JSDoc for IDE support)
// ============================================================================

/**
 * @typedef {Object} DIContainer
 * @property {string} name - Module name
 * @property {Function} setDependencies - Inject dependencies (supports { replace: true })
 * @property {Function} reset - Clear all injected dependencies
 * @property {Function} clear - Clear a specific dependency by key
 * @property {Function} resolve - Resolve and validate dependencies
 * @property {Function} getInjected - Get current injected deps
 * @property {Function} has - Check if dependency exists
 * @property {Function} update - Update single dependency
 * @property {Function} getRequiredKeys - List required dep keys
 * @property {Function} getOptionalKeys - List optional dep keys
 */

/**
 * @typedef {Object} DIOptions
 * @property {boolean} [strict=false] - Throw on missing required deps
 * @property {boolean} [logResolution=false] - Log dependency resolution
 */

console.log('📦 diBase module loaded');
