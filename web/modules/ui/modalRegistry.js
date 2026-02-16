/**
 * Modal Registry - Centralized modal element lookup with caching
 *
 * Single source of truth for modal element access. Static modals are cached
 * after first lookup; dynamic modals (cacheable: false) are always re-queried.
 *
 * NOT in registry:
 * - appInit.js data corruption modal (pre-Phase 2 emergency)
 * - notifications.js ephemeral overlays (created/destroyed per use)
 * - achievementsManager/historyManager/clearedTasksManager (instance-managed this.modalOverlay)
 *
 * @module ui/modalRegistry
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('ModalRegistry', {
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel))
});

export const setModalRegistryDependencies = (deps) => di.setDependencies(deps);

// Late-binding deps via Proxy (consistent with all other modules)
/** @type {{getElementById: Function, querySelector: Function}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// Cache of resolved modal elements
const _cache = new Map();

// ============================================================================
// MODAL DEFINITIONS
// ============================================================================

/**
 * Modal definitions: name -> how to find the element.
 * Single source of truth for which method + selector to use per modal.
 *
 * closeMethod values:
 * - 'close': dialog.close() (native dialog)
 * - 'display': style.display = 'none' (legacy div modals)
 * - 'addHidden': classList.add('hidden') (legacy div modals)
 *
 * cacheable: false means the element is destroyed and recreated at runtime,
 * so the cache must be bypassed (always re-query the DOM).
 */
export const MODAL_DEFS = {
    // ---- Static modals (pre-existing in HTML, safe to cache) ----
    feedback:           { method: 'id', key: DOM_IDS.FEEDBACK_MODAL, closeMethod: 'close' },
    about:              { method: 'id', key: DOM_IDS.ABOUT_MODAL, closeMethod: 'close' },
    reminders:          { method: 'id', key: DOM_IDS.REMINDERS_MODAL, closeMethod: 'close' },
    themes:             { method: 'id', key: DOM_IDS.THEMES_MODAL, closeMethod: 'close' },
    games:              { method: 'id', key: DOM_IDS.GAMES_PANEL, closeMethod: 'close' },
    preferences:        { method: 'id', key: DOM_IDS.PREFERENCES_MODAL, closeMethod: 'close' },
    testing:            { method: 'id', key: DOM_IDS.TESTING_MODAL, closeMethod: 'display' },
    help:               { method: 'id', key: DOM_IDS.HELP_WINDOW, closeMethod: 'display', persistent: true },
    recurringOverlay:   { method: 'id', key: DOM_IDS.RECURRING_PANEL_OVERLAY, closeMethod: 'close' },
    recurringPanel:     { method: 'id', key: DOM_IDS.RECURRING_PANEL, closeMethod: 'close' },
    storageViewer:      { method: 'id', key: DOM_IDS.STORAGE_VIEWER_OVERLAY, closeMethod: 'addHidden' },
    routineSwitcher:    { method: 'id', key: DOM_IDS.ROUTINE_SWITCHER_MODAL, closeMethod: 'close' },
    settings:           { method: 'id', key: DOM_IDS.SETTINGS_MODAL, closeMethod: 'close' },

    // ---- Dynamic modals (destroyed + recreated, NOT safe to cache) ----
    taskOptionsCustomizer: { method: 'id', key: DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL, cacheable: false, closeMethod: 'close' },
};

// ============================================================================
// PUBLIC API
// ============================================================================

/** All modal names, for iteration (e.g., closeAllModals). */
export const MODAL_NAMES = Object.keys(MODAL_DEFS);

/**
 * Get a modal element by name.
 * Static modals are cached after first lookup.
 * Dynamic modals (cacheable: false) are always re-queried.
 *
 * @param {string} name - Key from MODAL_DEFS
 * @returns {HTMLElement|null}
 */
export function getModal(name) {
    const def = MODAL_DEFS[name];
    if (!def) {
        console.warn(`Unknown modal: ${name}`);
        return null;
    }

    // Return cached element for static modals
    const cacheable = def.cacheable !== false;
    if (cacheable && _cache.has(name)) return _cache.get(name);

    const el = def.method === 'id'
        ? _deps.getElementById(def.key)
        : _deps.querySelector(def.key);

    if (el && cacheable) _cache.set(name, el);
    return el;
}

/**
 * Invalidate a specific cached modal (call after DOM rebuild).
 * @param {string} name - Key from MODAL_DEFS
 */
export function invalidateModal(name) {
    _cache.delete(name);
}

/**
 * Clear the entire cache (useful after full DOM rebuild or in tests).
 */
export function clearModalCache() {
    _cache.clear();
}

console.log('Modal Registry module loaded');
