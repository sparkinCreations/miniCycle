/**
 * @file labelResolver.js
 * @description Label resolution with pluralization, interpolation, and future lens support
 * @module labels/labelResolver
 *
 * This module provides getLabel() for resolving user-facing strings from the
 * centralized label registry. It supports:
 * - Noun pluralization ({ one, other } objects)
 * - Variable interpolation ({varName} syntax)
 * - Future: contextual lens overrides
 *
 * USAGE:
 * import { getLabel } from '../labels/labelResolver.js';
 *
 * getLabel('action.addTask');                           // 'Add task'
 * getLabel('noun.task', { count: 3 });                  // 'tasks'
 * getLabel('notify.taskRenamed', { vars: { name: 'Buy groceries' } });
 *                                                       // 'Task renamed to "Buy groceries"'
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DEFAULT_LABELS, LENS_SENSITIVE_KEYS } from './defaultLabels.js';

// ============================================================================
// DI SETUP
// ============================================================================

const di = createDIModule('LabelResolver', {
    // Future: function that returns the active lens for the current routine
    getActiveLens: optional(null),
    // Future: function that returns a per-routine lens override
    getRoutineLens: optional(null)
});

export const setLabelResolverDependencies = di.setDependencies;

// ============================================================================
// LABEL RESOLUTION
// ============================================================================

/**
 * Get a resolved label string
 *
 * @param {string} key - Dot-path key (e.g., 'action.addTask', 'noun.task')
 * @param {Object} [options] - Resolution options
 * @param {number} [options.count=1] - Count for pluralization (1 = singular, other = plural)
 * @param {Object} [options.vars={}] - Variables for interpolation
 * @param {string} [options.routineId] - Routine ID for per-routine lens (future)
 * @returns {string} Resolved label string, or the key if not found
 *
 * @example
 * // Simple lookup
 * getLabel('action.addTask')  // 'Add task'
 *
 * @example
 * // Pluralization
 * getLabel('noun.task', { count: 1 })  // 'task'
 * getLabel('noun.task', { count: 5 })  // 'tasks'
 *
 * @example
 * // Variable interpolation
 * getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } })
 * // 'Task renamed to "Buy milk"'
 *
 * @example
 * // Count + interpolation
 * getLabel('stats.completion', { count: 3, vars: { completed: 3, total: 5 } })
 * // '3 of 5 Tasks Completed'
 */
export function getLabel(key, options = {}) {
    const { count = 1, vars = {}, routineId = null } = options;

    // Parse dot-path: 'category.keyName' or 'category.keyName.subKey'
    const parts = key.split('.');
    if (parts.length < 2) {
        console.warn(`LabelResolver: Invalid key format "${key}" (expected "category.key")`);
        return key;
    }

    const category = parts[0];
    const labelKey = parts.slice(1).join('.');

    // Future: Check for lens override
    // const deps = di.resolve();
    // const lens = routineId
    //     ? deps.getRoutineLens?.(routineId)
    //     : deps.getActiveLens?.();
    // if (lens?.labels?.[category]?.[labelKey]) {
    //     label = lens.labels[category][labelKey];
    // }

    // Resolve from defaults
    const categoryObj = DEFAULT_LABELS[category];
    if (!categoryObj) {
        console.warn(`LabelResolver: Unknown category "${category}"`);
        return key;
    }

    // Navigate to the label (handles nested keys like 'noun.task' → { one, other })
    const label = categoryObj[labelKey];
    if (label === undefined) {
        console.warn(`LabelResolver: Unknown key "${key}"`);
        return key;
    }

    // Handle noun pluralization: { one: 'task', other: 'tasks' }
    if (typeof label === 'object' && label !== null && ('one' in label || 'other' in label)) {
        const form = count === 1 ? 'one' : 'other';
        const selected = label[form] ?? label.other ?? label.one;
        return interpolate(selected, { count, ...vars });
    }

    // Handle plain string with potential interpolation
    if (typeof label === 'string') {
        return interpolate(label, { count, ...vars });
    }

    // Fallback for unexpected types
    return String(label);
}

/**
 * Get a label with guaranteed string return (never returns the key)
 * Use when you need a fallback value instead of the key on failure
 *
 * @param {string} key - Dot-path key
 * @param {string} fallback - Fallback if key not found
 * @param {Object} [options] - Resolution options (same as getLabel)
 * @returns {string} Resolved label or fallback
 */
export function getLabelOrFallback(key, fallback, options = {}) {
    const result = getLabel(key, options);
    return result === key ? fallback : result;
}

/**
 * Check if a key exists in the label registry
 *
 * @param {string} key - Dot-path key
 * @returns {boolean} True if key exists
 */
export function hasLabel(key) {
    const parts = key.split('.');
    if (parts.length < 2) return false;

    const category = parts[0];
    const labelKey = parts.slice(1).join('.');

    const categoryObj = DEFAULT_LABELS[category];
    if (!categoryObj) return false;

    return labelKey in categoryObj;
}

/**
 * Check if a key is lens-sensitive (would change with contextual lens)
 *
 * @param {string} key - Dot-path key
 * @returns {boolean} True if lens-sensitive
 */
export function isLensSensitive(key) {
    return LENS_SENSITIVE_KEYS.has(key);
}

/**
 * Get all keys in a category
 *
 * @param {string} category - Category name (e.g., 'action', 'notify')
 * @returns {string[]} Array of full dot-path keys
 */
export function getKeysInCategory(category) {
    const categoryObj = DEFAULT_LABELS[category];
    if (!categoryObj) return [];

    return Object.keys(categoryObj).map(k => `${category}.${k}`);
}

/**
 * Get all lens-sensitive keys
 *
 * @returns {string[]} Array of lens-sensitive dot-path keys
 */
export function getLensSensitiveKeys() {
    return Array.from(LENS_SENSITIVE_KEYS);
}

// ============================================================================
// INTERPOLATION
// ============================================================================

/**
 * Interpolate variables into a template string
 * Supports: {varName} simple substitution
 *
 * @param {string} template - Template string with {varName} placeholders
 * @param {Object} vars - Variable values
 * @returns {string} Interpolated string
 *
 * @example
 * interpolate('Hello {name}!', { name: 'World' })  // 'Hello World!'
 * interpolate('{count} items', { count: 5 })       // '5 items'
 */
function interpolate(template, vars) {
    if (!template || typeof template !== 'string') {
        return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, varName) => {
        if (varName in vars) {
            return String(vars[varName]);
        }
        // Leave unmatched placeholders as-is (helps debugging)
        return match;
    });
}

// ============================================================================
// BATCH OPERATIONS (for performance-critical paths)
// ============================================================================

/**
 * Resolve multiple labels at once
 * More efficient than multiple getLabel() calls when resolving many keys
 *
 * @param {string[]} keys - Array of dot-path keys
 * @param {Object} [sharedOptions] - Options applied to all resolutions
 * @returns {Object} Map of key → resolved label
 *
 * @example
 * const labels = getLabels(['action.addTask', 'action.deleteTask', 'button.save']);
 * // { 'action.addTask': 'Add task', 'action.deleteTask': 'Delete task', 'button.save': 'Save' }
 */
export function getLabels(keys, sharedOptions = {}) {
    const result = {};
    for (const key of keys) {
        result[key] = getLabel(key, sharedOptions);
    }
    return result;
}

/**
 * Get all labels in a category as an object
 *
 * @param {string} category - Category name
 * @param {Object} [options] - Resolution options
 * @returns {Object} Map of key → resolved label (without category prefix)
 *
 * @example
 * const buttons = getCategoryLabels('button');
 * // { save: 'Save', cancel: 'Cancel', close: 'Close', ... }
 */
export function getCategoryLabels(category, options = {}) {
    const categoryObj = DEFAULT_LABELS[category];
    if (!categoryObj) return {};

    const result = {};
    for (const key of Object.keys(categoryObj)) {
        result[key] = getLabel(`${category}.${key}`, options);
    }
    return result;
}

// ============================================================================
// VERSION & DIAGNOSTICS
// ============================================================================

export const LABEL_RESOLVER_VERSION = globalThis.APP_VERSION;

/**
 * Get diagnostic info about the label system
 * @returns {Object} Diagnostic data
 */
export function getLabelDiagnostics() {
    const categories = Object.keys(DEFAULT_LABELS);
    let totalKeys = 0;
    for (const cat of categories) {
        totalKeys += Object.keys(DEFAULT_LABELS[cat]).length;
    }

    return {
        version: LABEL_RESOLVER_VERSION,
        categories: categories.length,
        totalKeys,
        lensSensitiveKeys: LENS_SENSITIVE_KEYS.size,
        activeLens: null // Future: di.resolve().getActiveLens?.()?.id
    };
}

console.log(`🏷️ Label resolver loaded (v${LABEL_RESOLVER_VERSION})`);
