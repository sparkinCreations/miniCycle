/**
 * @file migrationFacade.js
 * @description Facade for migration functions - consolidates 8 globals into one export
 * @module modules/core/migrationFacade
 *
 * Created Dec 2025 to reduce window.* pollution.
 * All migration functions are imported from migrationManager and exposed via this facade.
 *
 * Instead of:
 *   window.createInitialSchema25Data()
 *   window.performSchema25Migration()
 *   etc.
 *
 * Use:
 *   import { MigrationFacade } from './migrationFacade.js';
 *   MigrationFacade.createInitialData();
 *   MigrationFacade.performMigration();
 */

// Will be populated when initMigrationFacade is called
let migrationModule = null;

/**
 * Initialize the migration facade with the migration module
 * @param {Object} migrationMod - The imported migration module
 */
export function initMigrationFacade(migrationMod) {
    migrationModule = migrationMod;
}

/**
 * Migration Facade - unified access to all migration functions
 * Reduces 8 window.* globals to 1 importable object
 */
export const MigrationFacade = {
    /**
     * Create initial Schema 2.5 data structure
     */
    createInitialData() {
        return migrationModule?.createInitialSchema25Data?.();
    },

    /**
     * Check if migration is needed
     */
    checkNeeded() {
        return migrationModule?.checkMigrationNeeded?.();
    },

    /**
     * Simulate migration without applying changes
     */
    simulate() {
        return migrationModule?.simulateMigrationToSchema25?.();
    },

    /**
     * Perform the Schema 2.5 migration
     */
    performMigration() {
        return migrationModule?.performSchema25Migration?.();
    },

    /**
     * Validate all miniCycle tasks (lenient mode)
     */
    validateTasks() {
        return migrationModule?.validateAllMiniCycleTasksLenient?.();
    },

    /**
     * Fix task validation issues
     */
    fixIssues() {
        return migrationModule?.fixTaskValidationIssues?.();
    },

    /**
     * Initialize app with automatic migration
     */
    initWithAutoMigration() {
        return migrationModule?.initAppWithAutoMigration?.();
    },

    /**
     * Force migration (even if not needed)
     */
    forceMigration() {
        return migrationModule?.forceAppMigration?.();
    },

    // ========== Direct access to original functions ==========
    // For cases where you need the original function reference

    get createInitialSchema25Data() {
        return migrationModule?.createInitialSchema25Data;
    },

    get checkMigrationNeeded() {
        return migrationModule?.checkMigrationNeeded;
    },

    get simulateMigrationToSchema25() {
        return migrationModule?.simulateMigrationToSchema25;
    },

    get performSchema25Migration() {
        return migrationModule?.performSchema25Migration;
    },

    get validateAllMiniCycleTasksLenient() {
        return migrationModule?.validateAllMiniCycleTasksLenient;
    },

    get fixTaskValidationIssues() {
        return migrationModule?.fixTaskValidationIssues;
    },

    get initAppWithAutoMigration() {
        return migrationModule?.initAppWithAutoMigration;
    },

    get forceAppMigration() {
        return migrationModule?.forceAppMigration;
    }
};

// Also export individual functions for those who prefer direct imports

/**
 * Create an initial Schema 2.5 data structure for a fresh install.
 * @returns {Object} Empty Schema 2.5 data object.
 */
export function createInitialSchema25Data() {
    return MigrationFacade.createInitialData();
}

/**
 * Check whether a migration to Schema 2.5 is needed.
 * @returns {boolean} True if migration is required.
 */
export function checkMigrationNeeded() {
    return MigrationFacade.checkNeeded();
}

/**
 * Simulate the Schema 2.5 migration without applying changes.
 * @returns {Object} Simulation result with projected changes.
 */
export function simulateMigrationToSchema25() {
    return MigrationFacade.simulate();
}

/**
 * Perform the Schema 2.5 migration, transforming stored data in place.
 * @returns {Object} Migration result with status and details.
 */
export function performSchema25Migration() {
    return MigrationFacade.performMigration();
}

/**
 * Validate all miniCycle tasks using lenient rules.
 * @returns {Object} Validation result with any issues found.
 */
export function validateAllMiniCycleTasksLenient() {
    return MigrationFacade.validateTasks();
}

/**
 * Fix task validation issues found by the lenient validator.
 * @returns {Object} Fix result with details of corrections applied.
 */
export function fixTaskValidationIssues() {
    return MigrationFacade.fixIssues();
}

/**
 * Initialize the app with automatic migration if needed.
 * @returns {Object} Initialization result with migration status.
 */
export function initAppWithAutoMigration() {
    return MigrationFacade.initWithAutoMigration();
}

/**
 * Force a migration even if one is not detected as needed.
 * @returns {Object} Migration result with status and details.
 */
export function forceAppMigration() {
    return MigrationFacade.forceMigration();
}

