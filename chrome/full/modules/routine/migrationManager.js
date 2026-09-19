/**
 * 🔄 miniCycle Migration Manager (DI-Pure)
 *
 * Owns the boot entry every user passes through (initAppWithAutoMigration) and the
 * fresh-install data shape (createInitialSchema25Data).
 *
 * The pre-2.5 migration that used to live here — legacy-key detection, the
 * transform, its backups, rollback, "legacy fallback mode" and the task-repair pass
 * over miniCycleStorage — was retired Sep 2026. Pre-2.5 predates the public launch
 * at minicycle.app, so no public user ever had that data, and the Schema 2.6
 * migration goes 2.5 → 2.6 only (docs/future-work/SCHEMA_2_6_PLAN.md, "Migration
 * seam"). Legacy keys (miniCycleStorage, lastUsedMiniCycle, miniCycleReminders) are
 * neither read nor deleted: a pre-launch browser that still has them keeps them.
 *
 * CRITICAL: Call setMigrationManagerDependencies() before using any functions!
 *
 * Dependencies: storage, now, initialSetup, onInitialSetupComplete
 *
 * @module modules/routine/migrationManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { SCHEMA } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('MigrationManager', {
    storage: optional(null),
    initialSetup: optional(null),
    onInitialSetupComplete: optional(null),
    now: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{storage: Storage|null, initialSetup: Function|null, onInitialSetupComplete: Function|null, now: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Configure migration manager dependencies
 * MUST be called before using any migration functions
 *
 * @param {Object} overrides - Dependency overrides
 * @param {Object} overrides.storage - localStorage reference
 * @param {Function} overrides.initialSetup - App initialization function
 * @param {Function} [overrides.onInitialSetupComplete] - Called after initialSetup resolves
 * @param {Function} overrides.now - Time function (for testing)
 */
export function setMigrationManagerDependencies(overrides = {}) {
    di.setDependencies(overrides);
}

/**
 * Ensure dependency is available (fail-fast)
 *
 * @param {string} name - Dependency name
 * @param {*} value - Dependency value to check
 * @throws {Error} If dependency is missing
 */
function assertInjected(name, value) {
    const isValid = name === 'storage' ? !!value : typeof value === 'function';

    if (!isValid) {
        throw new Error(
            `migrationManager: missing required dependency '${name}'. ` +
            `Call setMigrationManagerDependencies() first.`
        );
    }
}

// ==========================================
// 🆕 SCHEMA 2.5 INITIALIZATION
// ==========================================

/**
 * Create initial Schema 2.5 data structure
 * Used for first-time users or fresh start
 *
 * @public
 */
export function createInitialSchema25Data() {
    assertInjected('storage', _deps.storage);
    assertInjected('now', _deps.now);

    const initialData = {
        schemaVersion: SCHEMA.CURRENT,
        metadata: {
            createdAt: _deps.now(),
            lastModified: _deps.now(),
            migratedFrom: null,
            migrationDate: null,
            totalRoutinesCreated: 0,
            totalCyclesCompleted: 0,
            schemaVersion: SCHEMA.CURRENT
        },
        settings: {
            theme: 'default',
            darkMode: false,
            alwaysShowRecurring: false,
            autoSave: true,
            // Mirrors isTouchCapable() in deviceDetection.js — deliberately NOT
            // isTouchDevice(). That one returns false as soon as a fine pointer
            // exists, so a touchscreen laptop was treated as mouse-only and started
            // with no three-dots menu. In laptop mode the CSS hover rule still
            // reveals options, but folded into tablet mode there is no trackpad to
            // hover with and the only remaining path is a 500ms long-press nothing
            // advertises. `any-pointer: coarse` is true whenever a touch pointer is
            // available, primary or not, which is the question that matters here.
            showThreeDots: (window.matchMedia?.('(any-pointer: coarse)')?.matches ?? false)
                || ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0,
            onboardingCompleted: false,
            guidedTourStep: null,
            statsTourStep: null,
            prefsTourStep: null,
            taskOptionsTourStep: null,
            remindersTourStep: null,
            menuTourStep: null,
            settingsTourStep: null,
            routineSwitcherTourStep: null,
            recurringListTourStep: null,
            recurringSettingsTourStep: null,
            historyTourStep: null,
            clearedTasksTourStep: null,
            achievementsTourStep: null,
            dismissedEducationalTips: {},
            defaultRecurringSettings: {
                frequency: "daily",
                indefinitely: true,
                time: null
            },
            unlockedThemes: [],
            unlockedFeatures: [],
            notificationPosition: { x: 0, y: 0 },
            notificationPositionModified: false,
            reducedMotion: false,
            highContrast: false,
            fontSize: '16'
        },
        data: {
            routine: {} // Empty - user will create their first routine
        },
        appState: {
            activeRoutineId: null, // No active routine yet
            overdueTaskStates: {} // ✅ Add this for overdue task tracking
        },
        userProgress: {
            cyclesCompleted: 0,
            rewardMilestones: []
        },
        customReminders: {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        }
    };

    _deps.storage.setItem("miniCycleData", JSON.stringify(initialData));
}

// ==========================================
// 🚀 APP INITIALIZATION
// ==========================================

/**
 * Boot entry: run the app's initial setup, then mark the app ready.
 *
 * Every boot passes through here (orchestrator, Phase 3). The name is kept from the
 * pre-2.5 migration era because this is where the Schema 2.6 migration will hang.
 * Today it migrates nothing — see the module header for why the pre-2.5 migration
 * was retired and what happens to leftover legacy keys (nothing).
 *
 * @returns {Promise<void>}
 * @public
 */
export async function initAppWithAutoMigration() {
    assertInjected('initialSetup', _deps.initialSetup);

    await _deps.initialSetup();
    _deps.onInitialSetupComplete?.();
}
